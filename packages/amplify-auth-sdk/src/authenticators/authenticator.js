import accepts from 'accepts';
import crypto from 'crypto';
import E from '../errors';
import fetch from 'node-fetch';
import getEndpoints from '../endpoints';
import jws from 'jws';
import opn from 'opn';
import snooplogg from 'snooplogg';
import TokenStore from '../stores/token-store';

import * as server from '../server';

import { renderHTML, stringifyQueryString } from '../util';

const { log } = snooplogg('amplify-auth:authenticator');
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
	 * Expiry timestamps for the access and refresh tokens.
	 *
	 * @type {Object}
	 * @access private
	 */
	expires = {
		access: null,
		refresh: null
	};

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
	 * The age in milliseconds before the access token expires and should be refreshed.
	 *
	 * @type {Number}
	 * @access private
	 */
	tokenRefreshThreshold = 0;

	/**
	 * The tokens returned from the server.
	 *
	 * @type {Object}
	 * @access private
	 */
	tokens = {};

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
	 * @param {Boolean} [opts.tokenRefreshThreshold=0] - The number of seconds before the access
	 * token expires and should be refreshed.
	 * @param {TokenStore} [opts.tokenStore] - A token store instance for persisting the tokens.
	 * @access public
	 */
	constructor(opts) {
		// check the environment
		this.env = opts.env;

		// process the base URL
		if (opts.baseUrl) {
			this.baseUrl = opts.baseUrl;
		}
		if (!this.baseUrl || typeof this.baseUrl !== 'string') {
			throw E.INVALID_BASE_URL('Invalid base URL: env or baseUrl required');
		}
		this.baseUrl = this.baseUrl.replace(/\/+$/, '');

		// validate the required string properties
		for (const prop of [ 'clientId', 'realm' ]) {
			if (!opts.hasOwnProperty(prop) || !opts[prop] || typeof opts[prop] !== 'string') {
				throw E.MISSING_REQUIRED_PARAMETER(`Expected required parameter "${prop}" to be a non-empty string`);
			}
			this[prop] = opts[prop];
		}

		// validate optional string options
		for (const prop of [ 'accessType', 'responseType', 'scope', 'serverHost' ]) {
			if (opts.hasOwnProperty(prop)) {
				if (typeof opts[prop] !== 'string') {
					throw E.INVALID_PARAMETER(`Expected parameter "${prop}" to be a string`);
				}
				this[prop] = opts[prop];
			}
		}

		// validate optional numeric options
		if (opts.hasOwnProperty('interactiveLoginTimeout')) {
			const timeout = parseInt(opts.interactiveLoginTimeout, 10);
			if (isNaN(timeout)) {
				throw E.INVALID_PARAMETER('Expected interactive login timeout to be a number of milliseconds');
			}

			if (timeout < 0) {
				throw E.INVALID_RANGE('Interactive login timeout must be greater than or equal to zero');
			}

			this.interactiveLoginTimeout = timeout;
		}

		if (opts.hasOwnProperty('serverPort')) {
			this.serverPort = parseInt(opts.serverPort, 10);
			if (isNaN(this.serverPort)) {
				throw E.INVALID_PARAMETER('Expected server port to be a number between 1024 and 65535');
			}

			if (this.serverPort < 1024 || this.serverPort > 65535) {
				throw E.INVALID_RANGE('Expected server port to be a number between 1024 and 65535');
			}
		}

		if (opts.hasOwnProperty('tokenRefreshThreshold')) {
			const threshold = parseInt(opts.tokenRefreshThreshold, 10);
			if (isNaN(threshold)) {
				throw E.INVALID_PARAMETER('Expected token refresh threshold to be a number of seconds');
			}

			if (threshold < 0) {
				throw E.INVALID_RANGE('Token refresh threshold must be greater than or equal to zero');
			}

			this.tokenRefreshThreshold = threshold * 1000;
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
				if (!this.endpoints.hasOwnProperty(name)) {
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
	 * Retrieves the access token. If the authenticator is interactive and the authenticator has not
	 * yet authenticated with the server, an error is thrown.
	 *
	 * @param {Boolean} [doLogin=false] - When `true` and non-interactive, it will attempt to log in
	 * using the refresh token.
	 * @returns {Promise<String>}
	 * @access public
	 */
	async getAccessToken(doLogin) {
		if (!this.tokens.access_token && this.tokenStore) {
			const accounts = await this.tokenStore.get(this.baseUrl);
			const data = accounts && accounts[0]; // FIXME
			if (data && data.tokens && data.expires) {
				log('Loaded access token from token store');
				Object.assign(this.tokens, data.tokens);
				Object.assign(this.expires, data.expires);
			}
		}

		if (this.tokens.access_token && this.expires.access > (Date.now() + this.tokenRefreshThreshold)) {
			return this.tokens.access_token;
		}

		log(this.tokens.access_token ? 'Access token expired' : 'No access token');

		// if we don't have an access token and we're interactive, then the refresh token is useless
		// and login is required
		if (!doLogin || this.interactive) {
			throw E.LOGIN_REQUIRED('Login required');
		}

		return await this.getToken();
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
	 * @returns {Promise<String>} Resolves the access token.
	 * @access public
	 */
	async getToken(code, requestId) {
		if (this.interactive && (!code || typeof code !== 'string')) {
			throw E.MISSING_AUTH_CODE('Expected code for interactive authentication to be a non-empty string');
		}

		const params = {
			clientId: this.clientId
		};

		if (this.tokens.refresh_token && this.expires.refresh > Date.now()) {
			Object.assign(params, {
				grantType:    Authenticator.GrantTypes.RefreshToken,
				refreshToken: this.tokens.refresh_token
			}, this.refreshTokenParams);
		} else {
			Object.assign(params, {
				scope: this.scope
			}, this.getTokenParams);
		}

		if (this.interactive) {
			params.code = code;
			params.redirectUri = `${this.serverUrl}/callback/${requestId}`;
		}

		const url = this.endpoints.token;
		const body = stringifyQueryString(params);

		log(`Fetching token: ${highlight(url)}`);
		log(`Post body: ${highlight(body)}`);

		const res = await fetch(url, {
			body,
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			method: 'POST'
		});

		if (!res.ok) {
			throw await this.handleRequestError(res, 'Authentication failed');
		}

		const tokens = await res.json();

		log('Authentication successful');
		log(tokens);

		let email;

		try {
			const info = jws.decode(tokens.id_token || tokens.access_token);
			log(info);
			email = info.payload.email.trim();
			if (!email) {
				// trigger the catch
				throw new Error();
			}
		} catch (e) {
			throw E.AUTH_FAILED('Authentication failed: invalid response from server');
		}

		const now = Date.now();
		this.expires.access  = (tokens.expires_in * 1000) + now;
		this.expires.refresh = (tokens.refresh_expires_in * 1000) + now;

		this.tokens = tokens;

		// persist the tokens
		if (this.tokenStore) {
			const account = {
				authenticator: this.constructor.name,
				baseUrl:       this.baseUrl,
				email,
				env:           this.env,
				expires:       this.expires,
				realm:         this.realm,
				tokens:        this.tokens
			};
			let accounts = await this.tokenStore.get(this.baseUrl);
			if (Array.isArray(accounts)) {
				for (let i = 0, len = accounts.length; i < len; i++) {
					if (accounts[i].email === email) {
						log(`Overwriting previous account credentials ${note(email)}`);
						accounts.splice(i, 1);
						break;
					} else {
						const { email, expires, tokens } = accounts[i];
						if (expires && tokens && tokens.access_token && tokens.refresh_token) {
							const now = Date.now();
							if ((expires.access > (now + this.tokenRefreshThreshold)) || (expires.refresh > now)) {
								continue;
							}
							log(`Removing expired token: ${email}`);
						} else {
							log('Removing invalid token');
						}
						accounts.splice(i, 1);
					}
				}
			} else {
				accounts = [];
			}
			accounts.push(account);
			await this.tokenStore.set(this.baseUrl, accounts);
		}

		return this.tokens.access_token;
	}

	/* istanbul ignore next */
	/**
	 * This property is meant to be overridden by authenticator implementations.
	 *
	 * @type {?Object}
	 * @access private
	 */
	get getTokenParams() {
		return null;
	}

	/**
	 * Constructs an error from a failed fetch request, logs it, and returns it.
	 *
	 * @param {Response} res - A fetch response object.
	 * @param {String} label - The error label.
	 * @access private
	 */
	async handleRequestError(res, label) {
		// authentication failed
		let msg = await res.text();

		try {
			const obj = JSON.parse(msg);
			msg = `${obj.error}: ${obj.error_description}`;
		} catch (e) {
			// squelch
		}

		msg = `${label}: ${msg.trim() || `server returned ${res.status}`}`;

		log(`${msg} ${note(`(${res.status})`)}`);
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
	 * @returns {Promise}
	 * @access public
	 */
	async login(opts = {}) {
		if (typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		if (!this.interactive) {
			log('Retrieving tokens non-interactively');
			const accessToken = await this.getAccessToken(true);
			return {
				accessToken,
				userInfo: await this.getUserInfo(accessToken)
			};
		}

		// we're interactive, so we either are manual, have an auth code, or starting a web server

		if (opts.hasOwnProperty('code')) {
			const accessToken = await this.getToken(opts.code);
			return {
				accessToken,
				userInfo: await this.getUserInfo(accessToken)
			};
		}

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

		log(`Starting login request ${highlight(requestId)} clientId=${highlight(this.clientId)} realm=${highlight(this.realm)}`);

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
		promise = promise.then(async accessToken => {
			return {
				accessToken,
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
		if (!opts.hasOwnProperty('wait')) {
			opts.wait = false;
		}
		log(`Launching default web browser: ${highlight(authorizationUrl)}`);
		opn(authorizationUrl, opts);

		// wait for authentication to succeed or fail
		return promise;
	}

	/**
	 * Revokes the access token.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	// async logout() {
	// 	// remove token from store
	// 	if (this.tokenStore) {
	// 		await this.tokenStore.delete(this.baseUrl);
	// 	}
	//
	// 	const refreshToken = this.tokens.refresh_token;
	//
	// 	this.expires.access = null;
	// 	this.expires.refresh = null;
	// 	this.tokens = {};
	//
	// 	if (!refreshToken) {
	// 		log('No refresh token, skipping logout');
	// 		return;
	// 	}
	//
	// 	const params = Object.assign({
	// 		clientId: this.clientId,
	// 		refreshToken
	// 	}, this.revokeTokenParams);
	//
	// 	const res = await fetch(this.endpoints.logout, {
	// 		body: stringifyQueryString(params),
	// 		method: 'post'
	// 	});
	//
	// 	if (!res.ok) {
	// 		const msg = await res.text();
	// 		log('Invalidated local tokens, but server failed to revoke access token');
	// 		log(msg);
	// 	}
	// }

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
	get revokeTokenParams() {
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

	/**
	 * Retrieves the user info associated with the access token.
	 *
	 * @returns {Promise<Object>}
	 * @access private
	 */
	async getUserInfo(accessToken) {
		log(`Fetching user info: ${highlight(this.endpoints.userinfo)} ${note(accessToken)}`);

		const res = await fetch(this.endpoints.userinfo, {
			headers: {
				Accept: 'application/json',
				Authorization: `Bearer ${accessToken}`
			}
		});

		if (!res.ok) {
			throw await this.handleRequestError(res, 'Fetch user info failed');
		}

		return await res.json();
	}
}
