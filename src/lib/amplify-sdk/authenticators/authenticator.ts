import E from '../errors.js';
import getEndpoints from '../../auth/endpoints.js';
import { decodeJwt } from 'jose';
import logger, { alert, highlight, note, ok } from '../../logger.js';
import TokenStore from '../stores/token-store.js';

import * as environments from '../../environments.js';
import * as request from '../../request.js';

import { md5, prepareForm } from '../util.js';

import { type Got } from 'got';

const { log, warn } = logger('amplify-sdk:authenticator');

/**
 * Orchestrates authentication and token management.
 */
export default class Authenticator {
	/**
	 * List of valid grant types to include with server requests.
	 *
	 * @type {Object}
	 * @access public
	 */
	static GrantTypes = {
		ClientCredentials: 'client_credentials',
		RefreshToken: 'refresh_token',
		JWTAssertion: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
	};

	/**
	 * The access type to send with requests.
	 *
	 * @type {String}
	 * @access private
	 */
	accessType = 'offline';

	/**
	 * When `true`, adds the authenticator params (client secret, private key, username/password)
	 * to the authenticated account object so that the access token can be refreshed when a
	 * refresh token is not available.
	 * @type {Boolean}
	 * @access private
	 */
	persistSecrets = false;

	/**
	 * The authorize URL.
	 *
	 * @type {String}
	 * @access private
	 */
	responseType = 'code';

	/**
	 * The scope to send with requests.
	 *
	 * @type {String}
	 * @access private
	 */
	scope = 'openid';

	/**
	 * The store to persist the token.
	 *
	 * @type {TokenStore}
	 * @access private
	 */
	tokenStore = null;

	/**
	 * The associated configuration profile.
	 */
	profile: string | null = null;

	baseUrl: string;
	platformUrl: string;
	clientId: string;
	realm: string;
	endpoints: Record<string, string>;
	env: any;
	got: Got;

	/**
	 * Initializes the authenticator instance.
	 *
	 * @param {Object} opts - Various options.
	 * @param {String} [opts.accessType=offline] - The access type to send with requests.
	 * @param {String} [opts.baseUrl] - The base URL to use for all outgoing requests.
	 * @param {String} opts.clientId - The client id to specify when authenticating.
	 * @param {Object} [opts.endpoints] - A map of endpoint names to endpoint URLs. Possible
	 * endpoints are: `auth`, `certs`, `logout`, `token`, `userinfo`, and `wellKnown`.
	 * @param {String} [opts.env=prod] - The environment name. Must be `staging` or `prod`.
	 * The environment is a shorthand way of specifying a Axway default base URL.
	 * @param {Boolean} [opts.persistSecrets] - When `true`, adds the authenticator params
	 * (client secret, private key, username/password) to the authenticated account object so that
	 * the access token can be refreshed when a refresh token is not available.
	 * @param {String} [opts.profile] - The name of the profile to use for authentication.
	 * @param {Function} [opts.got] - A reference to a `got` HTTP client. If not defined, the
	 * default `got` instance will be used.
	 * @param {String} opts.realm - The name of the realm to authenticate with.
	 * @param {String} [opts.responseType=code] - The response type to send with requests.
	 * @param {String} [opts.scope=openid] - The name of the scope to send with requests.
	 * @param {TokenStore} [opts.tokenStore] - A token store instance for persisting the tokens.
	 * @access public
	 */
	constructor(opts) {
		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		// check the environment
		this.env = environments.resolve(opts.env);

		// process the base URL
		if (opts.baseUrl) {
			this.baseUrl = opts.baseUrl;
		}
		if (!this.baseUrl || typeof this.baseUrl !== 'string') {
			throw E.MISSING_REQUIRED_PARAMETER('Invalid base URL: env or baseUrl required');
		}

		if (opts.profile) {
			if (typeof opts.profile !== 'string') {
				throw E.INVALID_PARAMETER('Expected profile to be a string');
			}
			this.profile = opts.profile;
		}

		this.platformUrl = opts.platformUrl || this.env.platformUrl;

		this.persistSecrets = opts.persistSecrets;

		// validate the required string properties
		for (const prop of [ 'clientId', 'realm' ]) {
			if (opts[prop] === undefined || !opts[prop] || typeof opts[prop] !== 'string') {
				throw E.MISSING_REQUIRED_PARAMETER(`Expected required parameter "${prop}" to be a non-empty string`);
			}
			this[prop] = opts[prop];
		}

		// validate optional string options
		for (const prop of [ 'accessType', 'responseType', 'scope' ]) {
			if (opts[prop] !== undefined) {
				if (typeof opts[prop] !== 'string') {
					throw E.INVALID_PARAMETER(`Expected parameter "${prop}" to be a string`);
				}
				this[prop] = opts[prop];
			}
		}

		// define the endpoints
		this.endpoints = getEndpoints(this);

		// set any endpoint overrides
		if (opts.endpoints) {
			if (typeof opts.endpoints !== 'object') {
				throw E.INVALID_PARAMETER('Expected endpoints to be an object of names to URLs');
			}
			for (const [ name, url ] of Object.entries(opts.endpoints)) {
				if (!url || typeof url !== 'string') {
					throw E.INVALID_PARAMETER(`Expected "${name}" endpoint URL to be a non-empty string`);
				}
				if (!this.endpoints[name]) {
					throw E.INVALID_VALUE(`Invalid endpoint "${name}"`);
				}
				this.endpoints[name] = url;
			}
		}

		if (opts.tokenStore) {
			if (!(opts.tokenStore instanceof TokenStore)) {
				throw E.INVALID_PARAMETER('Expected the token store to be a "TokenStore" instance');
			}
			this.tokenStore = opts.tokenStore;
		}

		this.got = opts.got || request.got;
	}

	/**
	 * Populates the latest user and session info into an account object.
	 *
	 * @param {Object} account - An object containing the account info.
	 * @returns {Object} The original account object.
	 * @access public
	 */
	async getInfo(account) {
		try {
			const accessToken = account.auth.tokens.access_token;
			log(`Fetching user info: ${highlight(this.endpoints.userinfo)} ${note(accessToken)}`);
			const { body } = await this.got(this.endpoints.userinfo, {
				headers: {
					Accept: 'application/json',
					Authorization: `Bearer ${accessToken}`
				},
				responseType: 'json',
				retry: { limit: 0 }
			});
			const { email, family_name, given_name, guid, org_guid, org_name } = body as any;

			if (!account.user || typeof account.user !== 'object') {
				account.user = {};
			}
			account.user.email = email;
			account.user.firstName = given_name;
			account.user.guid = guid || account.user.guid;
			account.user.lastName = family_name;

			if (!account.org || typeof account.org !== 'object') {
				account.org = {};
			}
			account.org.name = org_name;
			account.org.guid = org_guid;
		} catch (err) {
			const status = err.response?.statusCode;
			warn(`Fetch user info failed: ${err.message}${status ? ` (${status})` : ''}`);
		}

		// Ensure the account is associated with the correct profile
		if (this.profile) {
			account.profile = this.profile;
		}

		return account;
	}

	/**
	 * Authenticates with the server and retrieves the access and refresh tokens.
	 *
	 * @param {Boolean} [force] - When `true`, bypasses an existing valid token and gets a new
	 * token using the existing token.
	 * @returns {Promise<Object>} Resolves the account object.
	 * @access private
	 */
	async getToken(force?) {
		let now = Date.now();
		let expires;
		let tokens;
		let response;

		// if you have a code, then you probably don't want to have gone through all the hassle of
		// getting the code to only return the existing access token from the store
		if (this.tokenStore) {
			log(`Searching for existing tokens: ${highlight(this.hash)}`);
			for (const entry of await this.tokenStore.list()) {
				if (entry.hash === this.hash && ((!entry.profile && !this.profile) || entry.profile === this.profile)) {
					log('Found account in token store:');
					log(entry);

					({ expires, tokens } = entry.auth);
					if (!force && tokens.access_token && expires.access > now) {
						log('Token is still valid');
						return entry;
					}

					break;
				}
			}
		}

		const url = this.endpoints.token;
		const fetchTokens = async params => {
			try {
				log(`Fetching token: ${highlight(url)}`);
				log('Post form:', params);
				const response = await this.got.post(url, {
					form: prepareForm(params),
					responseType: 'json'
				});
				log(`${(response.statusCode >= 400 ? alert : ok)(String(response.statusCode))} ${highlight(url)}`);
				return response;
			} catch (err) {
				if (err.code === 'ECONNREFUSED') {
					// don't change the code, just re-throw
					throw err;
				}

				log(err);

				const desc = err.response?.body?.error_description;

				if (err.response?.body?.error === 'invalid_grant') {
					const e = E.AUTH_FAILED(`Invalid Grant${desc ? `: ${desc}` : ''}`);
					e.code = 'EINVALIDGRANT';
					e.statusCode = err.response.statusCode;
					e.statusMessage = err.response.statusMessage;
					throw e;
				}

				const e = E.AUTH_FAILED(`Authentication failed: ${desc ? `${desc}: ` : ''}${err.message}`);
				e.body = err.response?.body;
				e.statusCode = err.response?.statusCode;
				e.statusMessage = err.response?.statusMessage;
				throw e;
			}
		};

		if (tokens?.refresh_token && expires.refresh && expires.refresh > now) {
			log('Refreshing token using refresh token');
			response = await fetchTokens(Object.assign({
				clientId: this.clientId,
				grantType: Authenticator.GrantTypes.RefreshToken,
				refreshToken: tokens.refresh_token
			}, await this.refreshTokenParams));

		} else {
			// get new token using the code
			const params = Object.assign({
				clientId: this.clientId,
				scope: this.scope
			}, await this.tokenParams);

			response = await fetchTokens(params);
		}

		tokens = response.body;

		log(`Authentication successful ${note(`(${response.headers['content-type']})`)}`);
		log(tokens);

		let guid;
		let idp;
		let org;
		let name = this.hash;

		try {
			const info = decodeJwt(tokens.id_token || tokens.access_token);
			log(info);
			guid = info.guid;
			name = this.clientId; // TODO: Source the client's friendly name from platform?
			idp = info.identity_provider;
			const orgId = info.orgId;
			if (orgId) {
				org = { name: orgId, id: orgId };
			}
		} catch (_e) {
			throw E.AUTH_FAILED('Authentication failed: Invalid server response');
		}

		// refresh `now` and set the expiry timestamp
		now = Date.now();

		const refresh = tokens.refresh_token && tokens.refresh_expires_in ? (tokens.refresh_expires_in * 1000) + now : null;
		const account = await this.getInfo({
			auth: {
				authenticator: this.constructor.name,
				baseUrl: this.baseUrl,
				clientId: this.clientId,
				env: this.env.name,
				expires: {
					access: (tokens.expires_in * 1000) + now,
					refresh
				},
				idp,
				realm: this.realm,
				tokens
			},
			hash: this.hash,
			name,
			org,
			orgs: org ? [ org ] : [],
			user: {
				axwayId: undefined,
				guid,
				organization: undefined
			}
		});

		if (this.persistSecrets) {
			// add the secrets to the account object so that they can be used to refresh the access
			// token when there's no refresh token.
			log('Persisting secrets in token store');
			Object.assign(account.auth, this.authenticatorParams);
		} else {
			log('Not persisting secrets in token store');
		}

		// persist the tokens
		if (this.tokenStore) {
			await this.tokenStore.set(account);
		}

		if (!Object.getOwnPropertyDescriptor(account.auth, 'expired')) {
			Object.defineProperty(account.auth, 'expired', {
				configurable: true,
				get() {
					return this.expires.access < Date.now();
				}
			});
		}

		return account;
	}

	/**
	 * Generate the hash that attempts to uniquely identify this authentication methods and its
	 * parameters.
	 *
	 * @type {String}
	 * @access public
	 */
	get hash() {
		return this.clientId.replace(/\s/g, '_').replace(/_+/g, '_') + ':' + md5(Object.assign({
			baseUrl: this.baseUrl,
			env: this.env.name === 'prod' ? undefined : this.env.name,
			realm: this.realm
		}, this.hashParams));
	}

	/* istanbul ignore next */
	/**
	 * This property is meant to be overridden by authenticator implementations.
	 *
	 * @type {?Object}
	 * @access private
	 */
	get hashParams() {
		return null;
	}

	get authenticatorParams() {
		return null;
	}

	/**
	 * Fetches an access token from the configured AxwayID instance for use in future requests.
	 * @returns {Promise<Object>} The `account` info after successfully authenticating.
	 * @access public
	 */
	async login() {
		return this.getToken(true);
	}

	async timeout() {
		return new Promise(resolve => setTimeout(resolve, 3000));
	}

	/* istanbul ignore next */
	/**
	 * This property is meant to be overridden by authenticator implementations.
	 *
	 * @type {?Object}
	 * @access private
	 */
	get refreshTokenParams() {
		return null;
	}

	/* istanbul ignore next */
	/**
	 * This property is meant to be overridden by authenticator implementations.
	 *
	 * @type {?Object}
	 * @access private
	 */
	get tokenParams() {
		return null;
	}
}
