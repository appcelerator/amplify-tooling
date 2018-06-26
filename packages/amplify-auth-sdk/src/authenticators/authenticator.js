import fetch from 'node-fetch';
import http from 'http';
import jws from 'jws';
import opn from 'opn';
import snooplogg from 'snooplogg';

import { getServerInfo, stringifyQueryString } from '../util';
import { parse } from 'url';

const { log } = snooplogg('amplify-auth:authenticator');

/**
 * Orchestrates authentication and token management.
 */
export default class Authenticator {
	/**
	 * Environment specific settings.
	 *
	 * @type {Object}
	 * @access public
	 */
	static Environments = {
		dev: {
			baseUrl: 'https://login-dev.axway.com'
		},
		preprod: {
			baseUrl: 'https://login-preprod.axway.com'
		},
		prod: {
			baseUrl: 'https://login.axway.com'
		}
	};

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
	 * The authorize URL.
	 * @type {?String}
	 */
	authorizationUrl = null;

	/**
	 * The email address associated with the login used for persisting the tokens.
	 *
	 * @type {?String}
	 * @access private
	 */
	email = null;

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
	 * The HTTP server to use for interactive authentication.
	 *
	 * @type {http.Server}
	 * @access private
	 */
	server = null;

	/**
	 * The hostname to listen on when interactively authenticating.
	 *
	 * @type {String}
	 * @access private
	 */
	serverHost = '127.0.0.1';

	/**
	 * The port to listen on when interactively authenticating.
	 *
	 * @type {Number}
	 * @access private
	 */
	serverPort = 3000;

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
	 * The age in milliseconds before the access token expires and should be refreshed.
	 *
	 * @type {Number}
	 * @access private
	 */
	tokenRefreshThreshold = 5 * 60 * 1000; // 5 minutes

	/**
	 * The tokens returned from the server.
	 *
	 * @type {Object}
	 * @access private
	 */
	tokens = {};

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
	 * @param {Boolean} [opts.tokenRefreshThreshold=300] - The number of seconds before the access
	 * token expires and should be refreshed.
	 * @param {String} opts.realm - The name of the realm to authenticate with.
	 * @param {String} [opts.responseType=code] - The response type to send with requests.
	 * @param {String} [opts.scope=openid] - The name of the scope to send with requests.
	 * @access public
	 */
	constructor(opts) {
		// check the environment
		const env = Authenticator.Environments[opts.env || 'prod'];
		if (!env) {
			const err = new Error(`Invalid environment: ${opts.env}`);
			err.code = 'INVALID_ENVIRONMENT';
			throw err;
		}
		Object.assign(this, env);

		// process the base URL
		if (opts.baseUrl) {
			this.baseUrl = opts.baseUrl;
		}
		if (!this.baseUrl || typeof this.baseUrl !== 'string') {
			const err = new Error('Invalid base URL: env or baseUrl required');
			err.code = 'INVALID_BASE_URL';
			throw err;
		}
		this.baseUrl = this.baseUrl.replace(/\/+$/, '');

		// validate the required properties
		for (const prop of [ 'clientId', 'realm' ]) {
			if (!opts.hasOwnProperty(prop) || !opts[prop] || typeof opts[prop] !== 'string') {
				const err = new TypeError(`Expected required parameter "${prop}" to be a non-empty string`);
				err.code = 'MISSING_REQUIRED_PARAMETER';
				throw err;
			}
			this[prop] = opts[prop];
		}

		// validate optional properties
		for (const prop of [ 'accessType', 'responseType', 'scope', 'serverHost' ]) {
			if (opts.hasOwnProperty(prop)) {
				if (typeof opts[prop] !== 'string') {
					const err = new TypeError(`Expected parameter "${prop}" to be a string`);
					err.code = 'INVALID_PARAMETER';
					throw err;
				}
				this[prop] = opts[prop];
			}
		}

		if (opts.hasOwnProperty('serverPort')) {
			this.serverPort = parseInt(opts.serverPort, 10);
			if (isNaN(this.serverPort)) {
				const err = new TypeError('Expected server port to be a number between 1024 and 65535');
				err.code = 'INVALID_PARAMETER';
				throw err;
			}

			if (this.serverPort < 1024 || this.serverPort > 65535) {
				const err = new RangeError('Expected server port to be a number between 1024 and 65535');
				err.code = 'INVALID_PARAMETER';
				throw err;
			}
		}

		if (opts.hasOwnProperty('tokenRefreshThreshold')) {
			const threshold = parseInt(opts.tokenRefreshThreshold, 10);
			if (isNaN(threshold)) {
				const err = new TypeError('Expected token refresh threshold to be a number of seconds');
				err.code = 'INVALID_PARAMETER';
				throw err;
			}

			if (threshold < 0) {
				const err = new RangeError('Token refresh threshold must be greater than or equal to zero');
				err.code = 'INVALID_PARAMETER';
				throw err;
			}

			this.tokenRefreshThreshold = threshold * 1000;
		}

		// define the endpoints
		this.endpoints = {
			auth:      `${this.baseUrl}/auth/realms/${this.realm}/protocol/openid-connect/auth`,
			certs:     `${this.baseUrl}/auth/realms/${this.realm}/protocol/openid-connect/certs`,
			logout:    `${this.baseUrl}/auth/realms/${this.realm}/protocol/openid-connect/logout`,
			token:     `${this.baseUrl}/auth/realms/${this.realm}/protocol/openid-connect/token`,
			userinfo:  `${this.baseUrl}/auth/realms/${this.realm}/protocol/openid-connect/userinfo`,
			wellKnown: `${this.baseUrl}/auth/realms/${this.realm}/.well-known/openid-configuration`
		};

		// set any endpoint overrides
		if (opts.endpoints) {
			if (typeof opts.endpoints !== 'object') {
				const err = new TypeError('Expected endpoints to be an object of names to URLs');
				err.code = 'INVALID_PARAMETER';
				throw err;
			}
			for (const [ name, url ] of Object.entries(opts.endpoints)) {
				if (!url || typeof url !== 'string') {
					const err = new TypeError(`Expected "${name}" endpoint URL to be a non-empty string`);
					err.code = 'INVALID_PARAMETER';
					throw err;
				}
				if (!this.endpoints.hasOwnProperty(name)) {
					const err = new Error(`Cannot override invalid endpoint "${name}"`);
					err.code = 'INVALID_PARAMETER';
					throw err;
				}
				this.endpoints[name] = url;
			}
		}
	}

	/**
	 * Returns the time in milliseconds that the access token expires. If the token is already
	 * expired, it will return `null`.
	 *
	 * @type {?Number}
	 * @access public
	 */
	get expiresIn() {
		const { access } = this.expires;
		return access && access > Date.now() ? access : null;
	}

	/**
	 * Constructs a authorize URL based on the supplied parameters.
	 *
	 * @param {Object} params - Various parameters to include in the query string.
	 * @param {String} params.grantType - The grant type to send.
	 * @returns {String}
	 * @access private
	 */
	generateAuthorizationUrl(params) {
		params = Object.assign({
			accessType:   this.accessType,
			clientId:     this.clientId,
			scope:        this.scope,
			responseType: this.responseType,
			redirectUri:  `${this.serverUrl}/callback`
		}, params);

		return `${this.endpoints.auth}?${stringifyQueryString(params)}`;
	}

	/**
	 * Retrieves the access token. If the authenticator is interactive and the authenticator has not
	 * yet authenticated with the server, an error is thrown.
	 *
	 * @returns {Promise<String>}
	 * @access public
	 */
	async getAccessToken() {
		if (this.tokens.access_token && this.expires.access > (Date.now() + this.tokenRefreshThreshold)) {
			return this.tokens.access_token;
		}

		// if we don't have an access token and we're interactive, then the refresh token is useless
		// and login is required
		if (this.interactive) {
			const err = new Error('Login required');
			err.code = 'LOGIN_REQUIRED';
			throw err;
		}

		return await this.getToken();
	}

	/**
	 * Authenticates with the server and retrieves the access and refresh tokens.
	 *
	 * @param {String} [code] - When present, adds the code to the payload along with a redirect
	 * URL.
	 * @returns {Promise<String>} Resolves the access token.
	 * @access public
	 */
	async getToken(code) {
		if (this.interactive && (!code || typeof code !== 'string')) {
			const err = new TypeError('Expected code for interactive authentication to be a non-empty string');
			err.code = 'MISSING_AUTH_CODE';
			throw err;
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
		}

		log(`Fetching token: ${this.endpoints.token}`);
		log(params);

		const res = await fetch(this.endpoints.token, {
			body: stringifyQueryString(params),
			method: 'post'
		});

		if (!res.ok) {
			// authentication failed
			const msg = await res.text();
			const err = new Error(msg.trim() || 'Authentication failed');
			err.code = 'AUTH_FAILED';
			err.status = res.status;
			throw err;
		}

		const tokens = await res.json();

		try {
			const info = jws.decode(tokens.id_token || tokens.access_token);
			const payload = JSON.parse(info.payload);

			this.email = payload.email.trim();
			if (!this.email) {
				// trigger the catch
				throw new Error();
			}
		} catch (e) {
			const err = new Error('Authentication failed: invalid response from server');
			err.code = 'AUTH_FAILED';
			throw err;
		}

		const now = Date.now();
		this.expires.access  = (tokens.expires_in * 1000) + now;
		this.expires.refresh = (tokens.refresh_expires_in * 1000) + now;

		this.tokens = tokens;

		// TODO: persist the tokens using this.email, this.baseUrl, and this.tokens

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
	 * Orchestrates an interactive login flow or retrieves the access token non-interactively.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {String|Array.<String>} [opt.app] - Specify the app to open the `target` with, or an
	 * array with the app and app arguments.
	 * @param {Boolean} [opts.headless=false] - When `true`, it will return the auth URL instead of
	 * launching the auth URL in the default browser.
	 * @param {Boolean} [opts.wait=false] - Wait for the opened app to exit before fulfilling the
	 * promise. If `false` it's fulfilled immediately when opening the app.
	 * @returns {Promise}
	 * @access public
	 */
	async login(opts = {}) {
		if (typeof opts !== 'object') {
			const err = new TypeError('Expected options to be an object');
			err.code = 'INVALID_ARGUMENT';
			throw err;
		}

		if (!this.interactive) {
			log('Retrieving tokens non-interactively');
			return { accessToken: await this.getAccessToken() };
		}

		// we're interactive, so we either are headless or starting a web server

		if (opts.headless) {
			return { url: this.authorizationUrl };
		}

		// we can only do 1 login at a time because we can only have 1 web server at a time since
		// the callback success is bound to a single login call

		await this.stop();

		return new Promise((resolve, reject) => {
			log('Starting local HTTP server');
			this.server = http
				.createServer(async (req, res) => {
					const url = parse(req.url);

					try {
						switch (url.pathname) {
							case '/callback':
								// TODO: get the code from the query string, then use it to get the tokens
								console.log(url);

								// await this.getToken(code);

								res.end('Authorization successful! Please return to the console.');

								// only close the server if auth was successful
								await this.stop();

								resolve();

								break;

							default:
								res.writeHead(404, { 'Content-Type': 'text/plain' });
								res.end('Not Found');
						}
					} catch (e) {
						res.writeHead(400, { 'Content-Type': 'text/plain' });
						res.end(e.message);
					}
				})
				.on('listening', () => {
					log(`Local HTTP server started, launching default web browser: ${this.authorizationUrl}`);
					if (!opts.hasOwnProperty('wait')) {
						opts.wait = false;
					}
					opn(this.authorizationUrl, opts);
				})
				.on('error', reject)
				.listen(this.serverPort);
		});
	}

	/**
	 * Revokes the access token.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async logout() {
		// TODO: remove token from store
		// this.tokenStore.removeToken(this.email, this.baseUrl);

		const refreshToken = this.tokens.refresh_token;

		this.email = null;
		this.expires.access = null;
		this.expires.refresh = null;
		this.tokens = {};

		if (!refreshToken) {
			log('No refresh token, skipping logout');
			return;
		}

		const params = Object.assign({
			clientId: this.clientId,
			refreshToken
		}, this.revokeTokenParams);

		const res = await fetch(this.endpoints.logout, {
			body: stringifyQueryString(params),
			method: 'post'
		});

		if (!res.ok) {
			const msg = await res.text();
			log('Invalidated local tokens, but server failed to revoke access token');
			log(msg);
		}
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
	get revokeTokenParams() {
		return null;
	}

	/**
	 * Discovers available endpoints based on the remote server's OpenID configuration.
	 *
	 * @param {String} [url] - An optional URL to discover the available endpoints.
	 * @returns {Promise<Object>}
	 * @access public
	 */
	serverInfo(url) {
		return getServerInfo(url || this.endpoints.wellKnown);
	}

	/**
	 * Stops the internal web server used for interactive authentication.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async stop() {
		if (this.server) {
			await new Promise(resolve => {
				this.server.close(() => {
					log('Local HTTP server stopped');
					resolve();
				});
			});

			this.server = null;
		}
	}

	/**
	 * Retrieves the user info associated with the access token.
	 *
	 * @returns {Promise<Object>}
	 * @access public
	 */
	async userInfo() {
		const accessToken = await this.getAccessToken();

		const res = await fetch(this.endpoints.userinfo, {
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});

		return await res.json();
	}
}
