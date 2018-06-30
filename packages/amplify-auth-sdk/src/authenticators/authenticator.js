import accepts from 'accepts';
import crypto from 'crypto';
import E from '../errors';
import fetch from 'node-fetch';
import http from 'http';
import jws from 'jws';
import opn from 'opn';
import querystring from 'querystring';
import snooplogg from 'snooplogg';

import { getServerInfo, renderHTML, stringifyQueryString } from '../util';
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
			html: renderHTML('Authorization Successful!', 'Please return to the console.')
		}
	};

	/**
	 * A lookup of pending interactive logins.
	 *
	 * @type {Map}
	 * @access private
	 */
	pending = new Map();

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
	 * The local HTTP server hostname or IP address to listen on when interactively authenticating.
	 *
	 * @type {String}
	 * @access private
	 */
	serverHost = '127.0.0.1';

	/**
	 * The local HTTP server port to listen on when interactively authenticating.
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
	tokenRefreshThreshold = 0;

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
	 * @param {Object} [opts.messages] - A map of categorized messages to display to the end user.
	 * Supports plain text or HTML strings.
	 * @param {Boolean} [opts.tokenRefreshThreshold=0] - The number of seconds before the access
	 * token expires and should be refreshed.
	 * @param {String} opts.realm - The name of the realm to authenticate with.
	 * @param {String} [opts.responseType=code] - The response type to send with requests.
	 * @param {String} [opts.scope=openid] - The name of the scope to send with requests.
	 * @param {String} [opts.serverHost=127.0.0.1] - The local HTTP server hostname or IP address to
	 * listen on when interactively authenticating.
	 * @param {Number} [opts.serverPort=3000] - The local HTTP server port to listen on when
	 * interactively authenticating.
	 * @param {Number} [opts.interactiveLoginTimeout=120000] - The number of milliseconds to wait
	 * before shutting down the local HTTP server.
	 * @access public
	 */
	constructor(opts) {
		// check the environment
		const env = Authenticator.Environments[opts.env || 'prod'];
		if (!env) {
			throw E.INVALID_VALUE(`Invalid environment: ${opts.env}`);
		}
		Object.assign(this, env);

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

			for (const [ name, value ] of Object.entries(opts.message)) {
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
	 * Retrieves the access token. If the authenticator is interactive and the authenticator has not
	 * yet authenticated with the server, an error is thrown.
	 *
	 * @param {Boolean} [doLogin=false] - When `true` and non-interactive, it will attempt to log in
	 * using the refresh token.
	 * @returns {Promise<String>}
	 * @access public
	 */
	async getAccessToken(doLogin) {
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
					message = renderHTML('Authentication Error', err.message);
				} else {
					message = msg.html || renderHTML('Authentication', msg.text);
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
	 * @returns {Promise<String>} Resolves the access token.
	 * @access public
	 */
	async getToken(code) {
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
			log(`Authentication failed: ${msg} (${res.status})`);
			throw E.AUTH_FAILED(msg.trim() || 'Authentication failed', { status: res.status });
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
			throw E.AUTH_FAILED('Authentication failed: invalid response from server');
		}

		log('Authentication successful');
		log(tokens);
		log(`Email address: ${this.email}`);

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
			return { accessToken: await this.getAccessToken(true) };
		}

		// we're interactive, so we either are headless or starting a web server

		const queryParams = Object.assign({
			accessType:   this.accessType,
			clientId:     this.clientId,
			scope:        this.scope,
			responseType: this.responseType,
			redirectUri:  `${this.serverUrl}/callback`
		}, this.authorizationUrlParams);

		if (opts.headless) {
			return { url: `${this.endpoints.auth}?${stringifyQueryString(queryParams)}` };
		}

		// generate a request id so that we can match up successful callbacks with *this* login()
		const id = crypto.randomBytes(4).toString('hex').toUpperCase();

		log(`Starting login request ${id}`);

		// set up the timer to stop the server
		const timer = setTimeout(() => {
			const pending = this.pending.get(id);
			if (pending) {
				log(`Request ${id} timed out`);
				this.pending.delete(id);
				pending.reject(E.AUTH_TIMEOUT('Authentication timed out'));
			}
			this.stopServer();
		}, opts.timeout || this.interactiveLoginTimeout);

		if (!this.server) {
			// the server is not running, so start it
			await new Promise((resolve, reject) => {
				const callbackRegExp = /^\/(callback)(?:\/([A-Z0-9]+))?/;
				const connections = {};

				const server = http
					.createServer(async (req, res) => {
						try {
							const url = parse(req.url);
							const m = url.pathname.match(callbackRegExp);

							if (m && m[1] === 'callback') {
								const { code } = querystring.parse(url.query);
								const id = m[2];
								const pending = this.pending.get(id);

								if (!code) {
									throw new Error('Invalid auth code');
								}

								if (!pending) {
									throw new Error('Invalid request id');
								}

								log(`Request ${id} got code: ${code}`);

								log('Clearing timeout and pending');
								clearTimeout(pending.timer);
								this.pending.delete(id);

								// we do an inner try/catch because the request is valid, but auth
								// could still fail
								try {
									log('Getting token...');
									pending.resolve({
										accessToken: await this.getToken(code)
									});

									const { contentType, message } = this.getResponse(req, 'interactiveSuccess');
									res.writeHead(200, { 'Content-Type': contentType });
									res.end(message);
								} catch (e) {
									pending.reject(e);
									throw e;
								} finally {
									this.stopServer();
								}
							} else {
								const err = new Error('Not Found');
								err.status = 404;
								throw err;
							}
						} catch (e) {
							const { contentType, message } = this.getResponse(req, e);
							res.writeHead(e.status || 400, { 'Content-Type': contentType });
							res.end(message);
						}
					})
					.on('connection', conn => {
						const key = `${conn.remoteAddress}:${conn.remotePort}`;
						connections[key] = conn;
						conn.on('close', () => {
							delete connections[key];
						});
					})
					.on('listening', () => {
						log('Local HTTP server started');
						resolve();
					})
					.on('error', err => {
						this.server = null;
						reject(err);
					})
					.listen(this.serverPort);

				server.destroy = function destroy() {
					const p = new Promise(resolve => server.close(resolve));
					for (const conn of Object.values(connections)) {
						conn.destroy();
					}
					return p;
				};

				this.server = server;
			});
		}

		queryParams.redirectUri += `/${id}`;
		const authorizationUrl = `${this.endpoints.auth}?${stringifyQueryString(queryParams)}`;
		if (!opts.hasOwnProperty('wait')) {
			opts.wait = false;
		}
		log(`Launching default web browser: ${authorizationUrl}`);
		opn(authorizationUrl, opts);

		// wait for authentication to succeed or fail
		return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, timer }));
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
	async stopServer() {
		const { server } = this;
		if (server && !this.pending.size) {
			// null the server ref asap
			this.server = null;

			log('Destroying local HTTP server...');
			await server.destroy();
			log('Local HTTP server stopped');
		}
	}

	/**
	 * Retrieves the user info associated with the access token.
	 *
	 * @param {Boolean} [doLogin=false] - When `true` and non-interactive, it will attempt to log in
	 * using the refresh token.
	 * @returns {Promise<Object>}
	 * @access public
	 */
	async userInfo(doLogin) {
		const accessToken = await this.getAccessToken(doLogin);

		log(`Fetching user info: ${this.endpoints.userinfo}`);

		const res = await fetch(this.endpoints.userinfo, {
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		});
		return await res.json();
	}
}
