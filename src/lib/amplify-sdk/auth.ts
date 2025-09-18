import E from './errors.js';

import Authenticator from './authenticators/authenticator.js';
import ClientSecret from './authenticators/client-secret.js';
import SignedJWT from './authenticators/signed-jwt.js';

import FileStore from './stores/file-store.js';
import MemoryStore from './stores/memory-store.js';
import SecureStore from './stores/secure-store.js';
import TokenStore from './stores/token-store.js';

import getEndpoints from '../auth/endpoints.js';
import snooplogg from 'snooplogg';

import * as environments from '../environments.js';
import * as request from '../request.js';

const { log, warn } = snooplogg('amplify-sdk:auth');
const { highlight } = snooplogg.styles;

/**
 * Authenticates the machine and retrieves the auth token.
 */
export default class Auth {
	/**
	 * The number of seconds before the access token expires and should be refreshed.
	 *
	 * @type {Number}
	 * @access private
	 */
	tokenRefreshThreshold = 0;

	/**
	 * The store to persist the token.
	 *
	 * @type {TokenStore}
	 * @access private
	 */
	tokenStore = null;

	// TODO: Define correct typings for these props
	baseUrl: string | undefined;
	clientId: string | undefined;
	clientSecret: string | undefined;
	got: any;
	messages: any;
	realm: string | undefined;
	persistSecrets: boolean | undefined;
	platformUrl: string | undefined;
	secretFile: string | undefined;
	env: string | undefined;

	/**
	 * Initializes the authentication instance by setting the default settings and creating the
	 * token store.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {String} [opts.baseUrl] - The base URL to use for all outgoing requests.
	 * @param {String} [opts.clientId] - The client id to specify when authenticating.
	 * @param {String} [opts.clientSecret] - The secret token to use to authenticate.
	 * @param {String} [opts.env=prod] - The environment name. Must be `staging` or `prod`.
	 * The environment is a shorthand way of specifying a Axway default base URL.
	 * @param {Function} [opts.got] - A reference to a `got` HTTP client. If not defined, the
	 * default `got` instance will be used.
	 * @param {String} [opts.homeDir] - The path to the home directory containing the `lib`
	 * directory where `keytar` is located. This option is required when `tokenStoreType` is set to
	 * `secure`, which is the default.
	 * @param {Boolean} [opts.persistSecrets] - When `true`, adds the authenticator params
	 * (client secret, private key) to the authenticated account object so that
	 * the access token can be refreshed when a refresh token is not available.
	 * @param {String} [opts.platformUrl] - The URL to redirect the browser to after a
	 * successful login.
	 * @param {String} [opts.realm] - The name of the realm to authenticate with.
	 * @param {Object} [opts.requestOptions] - An options object to pass into Amplify CLI Utils to
	 * create the `got` HTTP client.
	 * @param {String} [opts.secretFile] - The path to the PEM formatted private key used to sign
	 * the JWT.
	 * @param {String} [opts.secureServiceName="Axway AMPLIFY Auth"] - The name of the consumer
	 * using this library when using the "secure" token store.
	 * @param {Boolean} [opts.tokenRefreshThreshold=0] - The number of seconds before the access
	 * token expires and should be refreshed.
	 * @param {TokenStore} [opts.tokenStore] - A token store instance for persisting the tokens.
	 * @param {String} [opts.tokenStoreDir] - The directory where the token store is saved. Required
	 * when the `tokenStoreType` is `secure` or `file`.
	 * @param {String} [opts.tokenStoreType=secure] - The type of store to persist the access token.
	 * Possible values include: `auto`, `secure`, `file`, or `memory`. If value is `auto`, it will
	 * attempt to use `secure`, then `file`, then `memory`. If set to `null`, then it will not
	 * persist the access token.
	 * @access public
	 */
	constructor(opts: any = {}) {
		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		if (opts.tokenRefreshThreshold !== undefined) {
			const threshold = parseInt(opts.tokenRefreshThreshold, 10);
			if (isNaN(threshold)) {
				throw E.INVALID_PARAMETER('Expected token refresh threshold to be a number of seconds');
			}

			if (threshold < 0) {
				throw E.INVALID_RANGE('Token refresh threshold must be greater than or equal to zero');
			}

			this.tokenRefreshThreshold = threshold;
		}

		Object.defineProperties(this, {
			baseUrl:        { value: opts.baseUrl },
			clientId:       { value: opts.clientId },
			clientSecret:   { value: opts.clientSecret },
			got:            { value: opts.got || request.init(opts.requestOptions) },
			messages:       { value: opts.messages },
			realm:          { value: opts.realm },
			persistSecrets: { writable: true, value: opts.persistSecrets },
			platformUrl:    { value: opts.platformUrl },
			secretFile:     { value: opts.secretFile }
		});

		this.env = environments.resolve(opts.env).name;

		if (opts.tokenStore) {
			if (!(opts.tokenStore instanceof TokenStore)) {
				throw E.INVALID_PARAMETER('Expected the token store to be a "TokenStore" instance');
			}
			this.tokenStore = opts.tokenStore;
		} else {
			const tokenStoreType = opts.tokenStoreType === undefined ? 'secure' : opts.tokenStoreType;
			switch (tokenStoreType) {
				case 'auto':
				case 'secure':
					try {
						this.tokenStore = new SecureStore(opts);

						// we know we're secure, so force persist secrets
						if (this.persistSecrets === undefined) {
							this.persistSecrets = true;
						}
						break;
					} catch (e) {
						/* istanbul ignore if */
						if (tokenStoreType === 'auto') {
							// let 'auto' fall through
						} else if (e.code === 'ERR_KEYTAR_NOT_FOUND') {
							throw E.SECURE_STORE_UNAVAILABLE('Secure token store is not available.\nPlease reinstall or rebuild this application.');
						} else {
							throw e;
						}
					}

				case 'file':
					try {
						this.tokenStore = new FileStore(opts);
						break;
					} catch (e) {
						/* istanbul ignore if */
						if (tokenStoreType === 'auto' && e.code === 'ERR_MISSING_REQUIRED_PARAMETER') {
							// let 'auto' fall through
						} else {
							throw e;
						}
					}

				case 'memory':
					this.tokenStore = new MemoryStore(opts);
					break;
			}
		}

		if (this.persistSecrets && !(this.tokenStore instanceof SecureStore)) {
			warn('Persist secrets has been enabled for non-secure token store');
			warn('Run "axway config rm auth.persistSecrets" to disable');
		}
	}

	/**
	 * Ensures the options contains the configurable settings. Validation is handled by the code
	 * requiring the values.
	 *
	 * @param {Object} [opts] - Various options.
	 * @returns {Object}
	 * @access private
	 */
	applyDefaults(opts: any = {}) {
		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		const name = opts.env || this.env;
		const env = environments.resolve(name);
		if (!env) {
			throw E.INVALID_VALUE(`Invalid environment: ${name}`);
		}

		// copy the options so we don't modify the original object since we don't own it
		return {
			...opts,
			baseUrl:        opts.baseUrl || this.baseUrl || env.baseUrl,
			clientId:       opts.clientId || this.clientId,
			clientSecret:   opts.clientSecret || this.clientSecret,
			env:            env.name,
			got:            opts.got || this.got,
			messages:       opts.messages || this.messages,
			persistSecrets: opts.persistSecrets !== undefined ? opts.persistSecrets : this.persistSecrets,
			platformUrl:    opts.platformUrl || this.platformUrl,
			realm:          opts.realm || this.realm,
			secretFile:     opts.secretFile || this.secretFile,
			tokenStore:     this.tokenStore,
		};
	}

	/**
	 * Creates an authenticator based on the supplied options.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Authenticator} [opts.authenticator] - An authenticator instance to use. If not
	 * specified, one will be auto-selected based on the options.
	 * @param {String} [opts.clientSecret] - The secret token to use to authenticate.
	 * @param {String} [opts.secretFile] - The path to the jwt secret file.
	 * @returns {Authenticator}
	 * @access public
	 */
	createAuthenticator(opts: any = {}) {
		if (opts.authenticator) {
			if (!(opts.authenticator instanceof Authenticator)) {
				throw E.INVALID_ARGUMENT('Expected authenticator to be an Authenticator instance.');
			}
			log(`Using existing ${highlight(opts.authenticator.constructor.name)} authenticator`);
			return opts.authenticator;
		}

		if (opts.persistSecrets === undefined) {
			opts.persistSecrets = this.persistSecrets;
		}

		if (typeof opts.username === 'string' && opts.username && typeof opts.password === 'string') {
			throw E.INVALID_ARGUMENT('Platform Username and Password authentication is no longer supported. Use a different authentication method.');
		}

		if (typeof opts.clientSecret === 'string' && opts.clientSecret) {
			log(`Creating ${highlight('ClientSecret')} authenticator`);
			return new ClientSecret(opts);
		}

		if (typeof opts.secretFile === 'string' && opts.secretFile) {
			log(`Creating ${highlight('SignedJWT')} authenticator`);
			return new SignedJWT(opts);
		}

		log(`Creating ${highlight('Base')} authenticator`);
		return new Authenticator(opts);
	}

	/**
	 * Finds an authenticated account using either the account name or the authentication
	 * parameters used to authenticate.
	 *
	 * This method is called by the AmplifySDK's `auth.login()` which uses the auth params
	 * (baseUrl, clientId, realm, plus authenticator specific data) to generate a unique hash which
	 * is then used to find an authenticated account. This is helpful to detect if you've already
	 * authenticated.
	 *
	 * It's important to note that the login command's `--client-id` takes on a different meaning
	 * compared to other commands. The login command will use the client id to generate the unique
	 * authenticator hash. This means that any command other, specifically ones like the
	 * `service-account` command, that have also have a `--client-id`, must operate against a known
	 * account name and NOT use their `--client-id` for the auth params that generates the unique
	 * authenticator hash.
	 *
	 * @param {Object|String} opts - Required options or a string containing the hash or account
	 * name.
	 * @param {String} opts.accountName - The account name to retrieve.
	 * @param {Authenticator} [opts.authenticator] - An authenticator instance to use. If not
	 * specified, one will be auto-selected based on the options.
	 * @param {String} [opts.baseUrl] - The base URL to filter by.
	 * @returns {Promise<?Object>}
	 * @access public
	 */
	async find(opts: any = {}) {
		if (!this.tokenStore) {
			log('Cannot get account, no token store');
			return null;
		}

		let authenticator;

		if (typeof opts === 'string') {
			opts = this.applyDefaults({ accountName: opts, hash: opts });
		} else {
			opts = this.applyDefaults(opts);
			authenticator = this.createAuthenticator(opts);
			log(`Authenticator hash: ${highlight(authenticator.hash)}`);
			opts.hash = authenticator.hash;
		}

		const account = await this.tokenStore.get(opts);
		if (!account) {
			return;
		}

		// copy over the correct auth params
		for (const prop of [ 'baseUrl', 'clientId', 'realm', 'env', 'clientSecret', 'secret' ]) {
			if (account.auth[prop] && opts[prop] !== account.auth[prop]) {
				log(`Overriding "${prop}" auth param with account's: ${opts[prop]} -> ${account.auth[prop]}`);
				opts[prop] = account.auth[prop];
			}
		}
		authenticator = this.createAuthenticator(opts);

		const { access, refresh } = account.auth.expires;
		let doRefresh = account.auth.expired;
		if (doRefresh) {
			log(`Access token for account ${highlight(account.name || account.hash)} has expired`);
			// If there is no valid refresh token, and no client secret or private key to re-authenticate, then we can't refresh the token
			if ((refresh || access) < Date.now() && !(account.auth.clientSecret || account.auth.secret)) {
				log(`Unable to refresh access token for account ${highlight(account.name || account.hash)} because refresh token is also expired`);
				return;
			}
		} else {
			const expiresIn = (refresh || access) - Date.now();
			if (this.tokenRefreshThreshold && expiresIn < this.tokenRefreshThreshold * 1000) {
				log(`Access token is valid, but will expire in ${expiresIn}ms (threshold ${this.tokenRefreshThreshold * 1000}ms), refreshing now`);
				doRefresh = true;
			} else {
				log(`Access token is valid and does not need to be refreshed, but will expire in ${expiresIn}ms (threshold ${this.tokenRefreshThreshold * 1000}ms)`);
			}
		}

		if (doRefresh) {
			try {
				log(`Refreshing access token for account ${highlight(account.name || account.hash)}`);
				return await authenticator.getToken(true);
			} catch (err) {
				if (err.code !== 'EINVALIDGRANT') {
					throw err;
				}
				if (account.auth.expired) {
					log(`Removing invalid account ${highlight(account.name || account.hash)} due to invalid refresh token`);
					warn(err.toString());
					await this.tokenStore.delete(account.name, opts.baseUrl);
					return null;
				} else {
					log(`Couldn't refresh account ${highlight(account.name || account.hash)}: ${err.toString()}`);
				}
			}
		}

		try {
			return await authenticator.getInfo(account);
		} catch (err) {
			if (err.statusCode === 401) {
				warn(`Removing invalid account ${highlight(account.name || account.hash)} due to stale token`);
				await this.tokenStore.delete(account.name, opts.baseUrl);
				return null;
			}
			if (!account.auth.expired) {
				log(`Couldn't refresh account ${highlight(account.name || account.hash)} info, skipping: ${err.toString()}`);
				return account;
			}
			throw err;
		}
	}

	/**
	 * Returns a list of all valid access tokens.
	 *
	 * @returns {Promise<Array>}
	 * @access public
	 */
	async list() {
		if (this.tokenStore) {
			return (await this.tokenStore.list())
				.filter(account => (account.auth.env || 'prod') === this.env);
		}
		return [];
	}

	/**
	 * Authenticates using the configured authenticator.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {String|Array.<String>} [opt.app] - The web browser app to open the `target` with, or
	 * an array with the app and app arguments.
	 * @param {Authenticator} [opts.authenticator] - An authenticator instance to use. If not
	 * specified, one will be auto-selected based on the options.
	 * @param {String} [opts.baseUrl] - The base URL to use for all outgoing requests.
	 * @param {String} [opts.clientId] - The client id to specify when authenticating.
	 * @param {String} [opts.env=prod] - The environment name. Must be `staging` or `prod`.
	 * The environment is a shorthand way of specifying a Axway default base URL.
	 * @param {Function} [opts.onOpenBrowser] - A callback when the web browser is about to be
	 * launched.
	 * @param {String} [opts.realm] - The name of the realm to authenticate with.
	 * @param {Number} [opts.timeout] - The number of milliseconds to wait before timing out.
	 * @returns {Promise<Object>} Resolves an object containing the access token, account name, and
	 * user info.
	 * @access public
	 */
	async login(opts = {}) {
		opts = this.applyDefaults(opts);
		const authenticator = this.createAuthenticator(opts);
		return await authenticator.login();
	}

	/**
	 * Revokes all or specific authenticated accounts.
	 *
	 * @param {Object} opts - Required options.
	 * @param {Array.<String>} opts.accounts - A list of accounts names or hashes.
	 * @param {Boolean} [opts.all] - When `true`, revokes all accounts.
	 * @param {String} [opts.baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise<Array>} Resolves a list of revoked credentials.
	 * @access public
	 */
	async logout({ accounts, all, baseUrl } = {} as any) {
		if (!this.tokenStore) {
			log('No token store, returning empty array');
			return [];
		}

		if (!all) {
			if (!accounts) {
				throw E.INVALID_ARGUMENT('Expected accounts to be a list of accounts');
			}
			if (typeof accounts === 'string') {
				accounts = [ accounts ];
			}
			if (!Array.isArray(accounts)) {
				throw E.INVALID_ARGUMENT('Expected accounts to be a list of accounts');
			}
			if (!accounts.length) {
				return [];
			}
		}

		if (all) {
			return this.tokenStore.clear(baseUrl);
		}
		return this.tokenStore.delete(accounts, baseUrl);
	}

	/**
	 * Discovers available endpoints based on the authentication server's OpenID configuration.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {String} [opts.baseUrl] - The base URL to use for all outgoing requests.
	 * @param {String} [opts.env=prod] - The environment name. Must be `staging` or `prod`.
	 * The environment is a shorthand way of specifying a Axway default base URL.
	 * @param {String} [opts.realm] - The name of the realm to authenticate with.
	 * @param {String} [opts.url] - An optional URL to discover the available endpoints.
	 * @returns {Promise<Object>}
	 * @access public
	 */
	async serverInfo(opts: any = {}) {
		opts = this.applyDefaults(opts);

		let { url } = opts;

		if (!url) {
			url = getEndpoints(opts).wellKnown;
		}

		if (!url || typeof url !== 'string') {
			throw E.INVALID_ARGUMENT('Expected URL to be a non-empty string');
		}

		try {
			log(`Fetching server info: ${highlight(url)}...`);
			return (await this.got(url, { responseType: 'json', retry: 0 })).body;
		} catch (err) {
			if (err.name !== 'ParseError') {
				err.message = `Failed to get server info (status ${err.response.statusCode})`;
			}
			throw err;
		}
	}

	/**
	 * Update the stored account.
	 *
	 * @param {Object} account - An object containing the account info.
	 * @returns {Promise}
	 * @access public
	 */
	async updateAccount(account) {
		if (this.tokenStore) {
			await this.tokenStore.set(account);
		}
	}
}
