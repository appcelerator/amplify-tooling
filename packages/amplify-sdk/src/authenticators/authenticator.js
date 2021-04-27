import E from '../errors';
import ejs from 'ejs';
import fs from 'fs-extra';
import getEndpoints from '../endpoints';
import jws from 'jws';
import open from 'open';
import path from 'path';
import snooplogg from 'snooplogg';
import TokenStore from '../stores/token-store';

import * as environments from '../environments';
import * as request from '@axway/amplify-request';
import Server from '../server';

import { createURL, md5, prepareForm } from '../util';

const { log, warn } = snooplogg('amplify-auth:authenticator');
const { green, highlight, red, note } = snooplogg.styles;

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
		AuthorizationCode: 'authorization_code',
		ClientCredentials: 'client_credentials',
		Password:          'password',
		RefreshToken:      'refresh_token',
		JWTAssertion:      'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
	};

	/**
	 * The access type to send with requests.
	 *
	 * @type {String}
	 * @access private
	 */
	accessType = 'offline';

	/**
	 * Defines if this authentication method is interactive. If `true`, then it will not attempt to
	 * automatically reinitialize expired tokens.
	 *
	 * @type {Boolean}
	 * @access private
	 */
	interactive = false;

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
	 * Initializes the authenticator instance.
	 *
	 * @param {Object} opts - Various options.
	 * @param {String} [opts.accessType=offline] - The access type to send with requests.
	 * @param {String} [opts.baseUrl] - The base URL to use for all outgoing requests.
	 * @param {String} opts.clientId - The client id to specify when authenticating.
	 * @param {Object} [opts.endpoints] - A map of endpoint names to endpoint URLs. Possible
	 * endpoints are: `auth`, `certs`, `logout`, `token`, `userinfo`, and `wellKnown`.
	 * @param {String} [opts.env=prod] - The environment name. Must be `dev`, `preprod`, or `prod`.
	 * The environment is a shorthand way of specifying a Axway default base URL.
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

		this.platformUrl = opts.platformUrl || this.env.platformUrl;

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

	/* istanbul ignore next */
	/**
	 * This property is meant to be overridden by authenticator implementations.
	 *
	 * @type {?Object}
	 * @access private
	 */
	get authorizationUrlParams() {
		return null;
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
				retry: 0
			});
			const { email, family_name, given_name, org_guid, org_name, user_guid } = body;

			if (!account.user || typeof account.user !== 'object') {
				account.user = {};
			}
			account.user.email     = email;
			account.user.firstName = given_name;
			account.user.guid      = user_guid;
			account.user.lastName  = family_name;

			if (!account.org || typeof account.org !== 'object') {
				account.org = {};
			}
			account.org.name = org_name;
			account.org.guid = org_guid;
		} catch (err) {
			const status = err.response?.statusCode;
			warn(`Fetch user info failed: ${err.message}${status ? ` (${status})` : ''}`);
		}

		return account;
	}

	/**
	 * Authenticates with the server and retrieves the access and refresh tokens.
	 *
	 * The `code` is undefined when doing a non-interactive login.
	 *
	 * @param {String} [code] - When present, adds the code to the payload along with a redirect
	 * URL.
	 * @param {String} [redirectUri] - The redirect URI that was passed in when first retrieving
	 * the code.
	 * @returns {Promise<Object>} Resolves the account object.
	 * @access private
	 */
	async getToken(code, redirectUri) {
		let now = Date.now();
		let expires;
		let tokens;
		let response;

		// if you have a code, then you probably don't want to have gone through all the hassle of
		// getting the code to only return the existing access token from the store
		if (!code && this.tokenStore) {
			log(`Searching for existing tokens: ${highlight(this.hash)}`);
			for (const entry of await this.tokenStore.list()) {
				if (entry.hash === this.hash) {
					log('Found account in token store:');
					log(entry);

					({ expires, tokens } = entry.auth);
					if (tokens.access_token && expires.access > now) {
						return entry;
					}

					log('Access token is expired, but the refresh token is still good');
					break;
				}
			}
		}

		const url = this.endpoints.token;
		const fetchTokens = async params => {
			try {
				log(`Fetching token: ${highlight(url)}`);
				log('Post form:', { ...params, password: '********' });
				const response = await this.got.post(url, {
					form: prepareForm(params),
					responseType: 'json'
				});
				log(`${(response.statusCode >= 400 ? red : green)(String(response.statusCode))} ${highlight(url)}`);
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
			// get new token using the refresh token
			response = await fetchTokens(Object.assign({
				clientId:     this.clientId,
				grantType:    Authenticator.GrantTypes.RefreshToken,
				refreshToken: tokens.refresh_token
			}, this.refreshTokenParams));
		} else {
			// get new token using the code
			const params = Object.assign({
				clientId: this.clientId,
				scope:    this.scope
			}, this.tokenParams);

			if (this.interactive) {
				if (!code || typeof code !== 'string') {
					throw E.MISSING_AUTH_CODE('Expected code for interactive authentication to be a non-empty string');
				}
				params.code = code;
				params.redirectUri = redirectUri;
			}

			response = await fetchTokens(params);
		}

		tokens = response.body;

		log(`Authentication successful ${note(`(${response.headers['content-type']})`)}`);
		log(tokens);

		let email = null;
		let org = null;
		let name = this.hash;

		try {
			const info = jws.decode(tokens.id_token || tokens.access_token);
			if (typeof info.payload === 'string') {
				info.payload = JSON.parse(info.payload);
			}
			log(info);
			email = (info.payload.email || '').trim();
			if (email) {
				name = `${this.clientId}:${email}`;
			}
			const { orgId } = info.payload;
			if (orgId) {
				org = { name: orgId, org_id: orgId };
			}
		} catch (e) {
			throw E.AUTH_FAILED('Authentication failed: Invalid server response');
		}

		// refresh `now` and set the expiry timestamp
		now = Date.now();

		const refresh = tokens.refresh_token && tokens.refresh_expires_in ? (tokens.refresh_expires_in * 1000) + now : null;
		const account = await this.getInfo({
			auth: {
				authenticator: this.constructor.name,
				baseUrl:       this.baseUrl,
				clientId:      this.clientId,
				env:           this.env.name,
				expires: {
					access: (tokens.expires_in * 1000) + now,
					refresh
				},
				realm:         this.realm,
				tokens
			},
			hash:              this.hash,
			name,
			org,
			orgs:              org ? [ org ] : [],
			user: {
				axwayId:       null,
				email,
				firstName:     null,
				guid:          null,
				lastName:      null,
				organization:  null
			}
		});

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
			baseUrl:  this.baseUrl,
			realm:    this.realm
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

	/**
	 * Orchestrates an interactive login flow or retrieves the access token non-interactively.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {String|Array.<String>} [opt.app] - Specify the app to open the `target` with, or an
	 * array with the app and app arguments.
	 * @param {String} [opts.code] - The authentication code from a successful interactive login.
	 * @param {Boolean} [opts.manual=false] - When `true`, it will return the auth URL instead of
	 * launching the auth URL in the default browser.
	 * @param {Function} [opts.onOpenBrowser] - A callback when the web browser is about to be
	 * launched.
	 * @param {Number} [opts.timeout] - The number of milliseconds to wait before timing out.
	 * @returns {Promise<Object>} In `manual` mode, then resolves an object containing the
	 * authentication `url`, a `promise` that is resolved once the browser redirects to the local
	 * web server after authenticating, and a `cancel` method to abort the authentication and stop
	 * the local web server. When not using `manual` mode, the `account` info is resolved after
	 * successfully authenticating.
	 * @access public
	 */
	async login(opts = {}) {
		if (!this.interactive || opts.code !== undefined) {
			if (this.interactive) {
				log('Retrieving tokens using auth code');
			} else {
				log('Retrieving tokens non-interactively');
			}
			return await this.getToken(opts.code);
		}

		// we're interactive, so we either are manual or starting a web server

		const server = new Server({
			timeout: opts.timeout
		});

		const orgSelectedCallback = await server.createCallback(async (req, res) => {
			res.writeHead(302, {
				'Content-Type': 'text/html',
				Location: this.platformUrl
			});
			const template = path.resolve(__dirname, '../../templates/auth.html.ejs');
			res.end(ejs.render(await fs.readFile(template, 'utf-8'), {
				title: 'Authorization Successful!',
				message: 'Please return to the console.'
			}));
		});

		const codeCallback = await server.createCallback(async (req, res, { searchParams }) => {
			const code = searchParams.get('code');
			if (!code) {
				throw new Error('Invalid auth code');
			}

			log(`Getting token using code: ${highlight(code)}`);
			const account = await this.getToken(code, codeCallback.url);

			res.writeHead(302, {
				Location: createURL(`${this.platformUrl}/#/auth/org.select`, {
					redirect: orgSelectedCallback.url
				})
			});
			res.end();

			return account;
		});

		const authorizationUrl = createURL(this.endpoints.auth, Object.assign({
			accessType:   this.accessType,
			clientId:     this.clientId,
			scope:        this.scope,
			responseType: this.responseType,
			redirectUri:  codeCallback.url
		}, this.authorizationUrlParams));

		log(`Starting ${opts.manual ? 'manual ' : ''}login request clientId=${highlight(this.clientId)} realm=${highlight(this.realm)}`);

		const promise = codeCallback.start()
			.then(async ({ result: account }) => {
				await orgSelectedCallback.start();
				return account;
			})
			.finally(() => server.stop());

		// if manual, return now with the auth url
		if (opts.manual) {
			return {
				cancel: () => Promise.all([ codeCallback.cancel(), orgSelectedCallback.cancel() ]),
				promise,
				url: authorizationUrl
			};
		}

		// launch the default web browser
		log(`Launching default web browser: ${highlight(authorizationUrl)}`);
		if (typeof opts.onOpenBrowser === 'function') {
			await opts.onOpenBrowser({ url: authorizationUrl });
		}
		try {
			await open(authorizationUrl, opts);
		} catch (err) {
			const m = err.message.match(/Exited with code (\d+)/i);
			throw m ? new Error(`Failed to open web browser (code ${m[1]})`) : err;
		}

		// wait for authentication to succeed or fail
		return promise;
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
