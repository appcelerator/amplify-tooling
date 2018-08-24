import accepts from 'accepts';
import crypto from 'crypto';
import E from '../errors';

import getEndpoints from '../endpoints';
import jws from 'jws';
import opn from 'opn';
import snooplogg from 'snooplogg';
import TokenStore from '../stores/token-store';

import * as server from '../server';

import { md5, renderHTML, stringifyQueryString } from '../util';
import { requestJSON } from '@axway/amplify-request';

const { error, log } = snooplogg('amplify-auth:authenticator');
const { highlight, note } = snooplogg.styles;

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
	 * The number of milliseconds to wait before shutting down the local HTTP server.
	 *
	 * @type {Number}
	 * @access private
	 */
	interactiveLoginTimeout = 120000; // 2 minutes

	/**
	 * Message strings displayed to the end user.
	 *
	 * @type {Object}
	 * @access private
	 */
	messages = {
		interactiveSuccess: {
			text: 'Authorization successful! Please return to the console.',
			html: renderHTML({ cls: 'success', title: 'Authorization Successful!', message: 'Please return to the console.' })
		}
	};

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
	 * The local HTTP server hostname or IP address to listen on when interactively authenticating.
	 *
	 * @type {String}
	 * @access private
	 */
	serverHost = 'localhost';

	/**
	 * The local HTTP server port to listen on when interactively authenticating.
	 *
	 * @type {Number}
	 * @access private
	 */
	serverPort = 3000;

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
	 * @param {Number} [opts.interactiveLoginTimeout=120000] - The number of milliseconds to wait
	 * before shutting down the local HTTP server.
	 * @param {Object} [opts.messages] - A map of categorized messages to display to the end user.
	 * Supports plain text or HTML strings.
	 * @param {String} opts.realm - The name of the realm to authenticate with.
	 * @param {String} [opts.responseType=code] - The response type to send with requests.
	 * @param {String} [opts.scope=openid] - The name of the scope to send with requests.
	 * @param {String} [opts.serverHost=127.0.0.1] - The local HTTP server hostname or IP address to
	 * listen on when interactively authenticating.
	 * @param {Number} [opts.serverPort=3000] - The local HTTP server port to listen on when
	 * interactively authenticating.
	 * @param {TokenStore} [opts.tokenStore] - A token store instance for persisting the tokens.
	 * @access public
	 */
	constructor(opts) {
		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		// check the environment
		this.env = opts.env;

		// process the base URL
		if (opts.baseUrl) {
			this.baseUrl = opts.baseUrl;
		}
		if (!this.baseUrl || typeof this.baseUrl !== 'string') {
			throw E.INVALID_BASE_URL('Invalid base URL: env or baseUrl required');
		}

		// validate the required string properties
		for (const prop of [ 'clientId', 'realm' ]) {
			if (opts[prop] === undefined || !opts[prop] || typeof opts[prop] !== 'string') {
				throw E.MISSING_REQUIRED_PARAMETER(`Expected required parameter "${prop}" to be a non-empty string`);
			}
			this[prop] = opts[prop];
		}

		// validate optional string options
		for (const prop of [ 'accessType', 'responseType', 'scope', 'serverHost' ]) {
			if (opts[prop] !== undefined) {
				if (typeof opts[prop] !== 'string') {
					throw E.INVALID_PARAMETER(`Expected parameter "${prop}" to be a string`);
				}
				this[prop] = opts[prop];
			}
		}

		// validate optional numeric options
		if (opts.interactiveLoginTimeout !== undefined) {
			const timeout = parseInt(opts.interactiveLoginTimeout, 10);
			if (isNaN(timeout)) {
				throw E.INVALID_PARAMETER('Expected interactive login timeout to be a number of milliseconds');
			}

			if (timeout < 0) {
				throw E.INVALID_RANGE('Interactive login timeout must be greater than or equal to zero');
			}

			this.interactiveLoginTimeout = timeout;
		}

		if (opts.serverPort !== undefined) {
			this.serverPort = parseInt(opts.serverPort, 10);
			if (isNaN(this.serverPort)) {
				throw E.INVALID_PARAMETER('Expected server port to be a number between 1024 and 65535');
			}

			if (this.serverPort < 1024 || this.serverPort > 65535) {
				throw E.INVALID_RANGE('Expected server port to be a number between 1024 and 65535');
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

		// set any message overrides
		if (opts.messages) {
			if (typeof opts.messages !== 'object') {
				throw E.INVALID_PARAMETER('Expected messages to be an object');
			}

			for (const [ name, value ] of Object.entries(opts.messages)) {
				const dest = this.messages[name] = this.messages[name] || {};

				if (typeof value === 'object') {
					for (const [ type, msg ] of Object.entries(value)) {
						dest[type] = String(msg).trim();
					}
				} else {
					dest.text = String(value).trim();
				}
			}
		}

		if (opts.tokenStore) {
			if (!(opts.tokenStore instanceof TokenStore)) {
				throw E.INVALID_PARAMETER('Expected the token store to be a "TokenStore" instance');
			}
			this.tokenStore = opts.tokenStore;
		}

		// generate the hash that attempts to uniquely identify this authentication methods and its
		// parameters
		this.hash = md5(Object.assign({
			baseUrl: this.baseUrl,
			realm:   this.realm
		}, this.hashParams));
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
	 * Generates an response from the local HTML server.
	 *
	 * @param {IncomingRequest} req - The incoming HTTP request.
	 * @param {String} result - An error or message id.
	 * @returns {Object}
	 * @access private
	 */
	getResponse(req, result) {
		const accept = accepts(req);
		const err = result instanceof Error ? result : null;
		const msg = err ? null : (this.messages[result] || { text: result });
		let contentType = 'text/plain';
		let message;

		switch (accept.type([ 'html', 'json' ])) {
			case 'html':
				contentType = 'text/html';
				if (err) {
					message = renderHTML({ cls: 'error', title: 'Authentication Error', message: err.message });
				} else {
					message = msg.html || renderHTML({ title: 'Authentication', message: msg.text });
				}
				break;

			case 'json':
				contentType = 'application/json';
				if (err) {
					message = JSON.stringify({
						message: err.message,
						success: false
					});
				} else {
					message = JSON.stringify({
						message: msg.text,
						success: true
					});
				}
				break;

			default:
				message = err ? err.toString() : msg.text;
		}

		return {
			contentType,
			message
		};
	}

	/**
	 * Authenticates with the server and retrieves the access and refresh tokens.
	 *
	 * @param {String} [code] - When present, adds the code to the payload along with a redirect
	 * URL.
	 * @param {String} [requestId] - Used to construct the redirect URI when using the `code`.
	 * @returns {Promise<Object>} Resolves an object containing the access token and account name.
	 * @access public
	 */
	async getToken(code, requestId) {
		if (this.interactive && (!code || typeof code !== 'string')) {
			throw E.MISSING_AUTH_CODE('Expected code for interactive authentication to be a non-empty string');
		}

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

					expires = entry.expires;
					tokens = entry.tokens;

					if (tokens.access_token && expires.access > now) {
						return {
							accessToken: tokens.access_token,
							account: entry
						};
					}

					log('Access token is expired, but the refresh token is still good');

					break;
				}
			}
		}

		const params = {
			clientId: this.clientId
		};

		if (tokens && tokens.refresh_token && expires.refresh > now) {
			Object.assign(params, {
				grantType:    Authenticator.GrantTypes.RefreshToken,
				refreshToken: tokens.refresh_token
			}, this.refreshTokenParams);
		} else {
			Object.assign(params, {
				scope: this.scope
			}, this.tokenParams);
		}

		if (this.interactive) {
			params.code = code;
			params.redirectUri = `${this.serverUrl}/callback${requestId ? `/${requestId}` : ''}`;
		}

		const url = this.endpoints.token;
		const body = stringifyQueryString(params);

		log(`Fetching token: ${highlight(url)}`);
		log(`Post body: ${highlight(body)}`);

		try {
			response = await requestJSON({
				body,
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				method: 'POST',
				url
			});
		} catch (err) {
			if (err.code === 'ECONNREFUSED') {
				throw err;
			}
			throw this.handleRequestError(err, 'Authentication failed');
		}

		tokens = response.body;

		log(`Authentication successful ${note(`(${response.headers['content-type']})`)}`);
		log(tokens);

		let name;

		try {
			const info = jws.decode(tokens.id_token || tokens.access_token);
			if (typeof info.payload === 'string') {
				info.payload = JSON.parse(info.payload);
			}
			log(info);
			name = info.payload.email.trim();
		} catch (e) {
			throw E.AUTH_FAILED('Authentication failed: Invalid server response');
		}

		if (!name) {
			// trigger the catch
			throw E.AUTH_FAILED('Authentication failed: Account has no email address');
		}

		// refresh `now` and set the expiry timestamp
		now = Date.now();

		const account = {
			authenticator: this.constructor.name,
			baseUrl:       this.baseUrl,
			env:           this.env,
			expires: {
				access: (tokens.expires_in * 1000) + now,
				refresh: (tokens.refresh_expires_in * 1000) + now
			},
			hash:          this.hash,
			name,
			realm:         this.realm,
			tokens
		};

		// persist the tokens
		if (this.tokenStore) {
			await this.tokenStore.set(account);
		}

		if (!Object.getOwnPropertyDescriptor(account, 'expired')) {
			Object.defineProperty(account, 'expired', {
				configurable: true,
				get() {
					return this.expires.access < Date.now();
				}
			});
		}

		return {
			accessToken: tokens.access_token,
			account
		};
	}

	/**
	 * Retrieves the user info associated with the access token.
	 *
	 * @param {String} accessToken - A non-expired access token.
	 * @returns {Promise<Object>}
	 * @access private
	 */
	async getUserInfo(accessToken) {
		log(`Fetching user info: ${highlight(this.endpoints.userinfo)} ${note(accessToken)}`);

		const response = await requestJSON({
			headers: {
				Accept: 'application/json',
				Authorization: `Bearer ${accessToken}`
			},
			url: this.endpoints.userinfo
		});

		if (response.statusCode >= 400) {
			throw await this.handleRequestError(response, 'Fetch user info failed');
		}

		return response.body;
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
	 * Constructs an error from a failed fetch request, logs it, and returns it.
	 *
	 * @param {Response} res - A fetch response object.
	 * @param {String} label - The error label.
	 * @returns {Promise<Error>}
	 * @access private
	 */
	handleRequestError(res, label) {
		// authentication failed
		let msg = res.error;
		try {
			const obj = JSON.parse(msg);
			msg = `${obj.error}: ${obj.error_description}`;
		} catch (e) {
			// squelch
		}

		msg = `${label}: ${msg.trim() || `server returned ${res.statusCode}`}`;

		error(`${msg} ${note(`(${res.status})`)}`);
		return E.AUTH_FAILED(msg, { status: res.status });
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
	 * @param {Number} [opts.timeout] - The number of milliseconds to wait before timing out.
	 * Defaults to the `interactiveLoginTimeout` property.
	 * @param {Boolean} [opts.wait=false] - Wait for the opened app to exit before fulfilling the
	 * promise. If `false` it's fulfilled immediately when opening the app.
	 * @returns {Promise<Object>} Resolves an object containing the access token, account name, and
	 * user info.
	 * @access public
	 */
	async login(opts = {}) {
		if (!this.interactive || opts.code !== undefined) {
			if (!this.interactive) {
				log('Retrieving tokens non-interactively');
			} else {
				log('Retrieving tokens using auth code');
			}
			const { accessToken, account } = await this.getToken(opts.code);
			return {
				accessToken,
				account,
				authenticator: this,
				userInfo: await this.getUserInfo(accessToken)
			};
		}

		// we're interactive, so we either are manual or starting a web server

		// generate a request id so that we can match up successful callbacks with *this* login()
		const requestId = crypto.randomBytes(4).toString('hex').toUpperCase();
		const queryParams = Object.assign({
			accessType:   this.accessType,
			clientId:     this.clientId,
			scope:        this.scope,
			responseType: this.responseType,
			redirectUri:  `${this.serverUrl}/callback/${requestId}`
		}, this.authorizationUrlParams);
		const authorizationUrl = `${this.endpoints.auth}?${stringifyQueryString(queryParams)}`;

		log(`Starting ${opts.manual ? 'manual ' : ''}login request ${highlight(requestId)} clientId=${highlight(this.clientId)} realm=${highlight(this.realm)}`);

		// start the server and wait for it to start
		let { cancel, promise } = await server.start({
			getResponse: (req, result) => this.getResponse(req, result),
			getToken:    (code, id) => this.getToken(code, id),
			requestId,
			serverHost:  this.serverHost,
			serverPort:  this.serverPort,
			timeout:     opts.timeout || this.interactiveLoginTimeout
		});

		// chain the promise to fetch the user info
		promise = promise.then(async ({ accessToken, account }) => {
			return {
				accessToken,
				account,
				authenticator: this,
				userInfo: await this.getUserInfo(accessToken)
			};
		});

		// if manual, return now with the auth url
		if (opts.manual) {
			return {
				cancel,
				promise,
				url: authorizationUrl
			};
		}

		// launch the default web browser
		if (opts.wait === undefined) {
			opts.wait = false;
		}
		log(`Launching default web browser: ${highlight(authorizationUrl)}`);
		opn(authorizationUrl, opts);

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

	/**
	 * The local HTTP server URL.
	 *
	 * @type {String}
	 * @access private
	 */
	get serverUrl() {
		return `http://${this.serverHost}:${this.serverPort}`;
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
