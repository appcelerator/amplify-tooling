import E from './errors.js';

import Authenticator from './authenticators/authenticator.js';
import ClientSecret, { ClientSecretOptions } from './authenticators/client-secret.js';
import OwnerPassword, { OwnerPasswordOptions } from './authenticators/owner-password.js';
import PKCE from './authenticators/pkce.js';
import SignedJWT, { SignedJWTOptions } from './authenticators/signed-jwt.js';

import FileStore from './stores/file-store.js';
import MemoryStore from './stores/memory-store.js';
import SecureStore from './stores/secure-store.js';
import TokenStore from './stores/token-store.js';

import getEndpoints from './endpoints.js';
import snooplogg from 'snooplogg';

import * as environments from './environments.js';
import * as request from '@axway/amplify-request';
import { Account, AccountAuthInfo, AuthenticatorOptions } from './types.js';
import { Got } from 'got/dist/source/types.js';

const { log, warn } = snooplogg('amplify-sdk:auth');
const { alert, highlight, magenta, note } = snooplogg.styles;

export interface AuthOptions {
	baseUrl?: string,
	clientId?: string,
	clientSecret?: string,
	env?: string,
	got?: Got,
	homeDir?: string,
	interactiveLoginTimeout?: number,
	password?: string,
	persistSecrets?: boolean,
	platformUrl?: string,
	realm?: string,
	requestOptions?: request.RequestOptions,
	secretFile?: string,
	secureServiceName?: string,
	serviceAccount?: boolean,
	tokenRefreshThreshold?: number,
	tokenStore?: TokenStore,
	tokenStoreDir?: string,
	tokenStoreType?: 'auto' | 'secure' | 'file' | 'memory' | null,
	username?: string
}

export interface DefaultOptions {
	accountName?: string,
	app?: string | string[],
	authenticator?: Authenticator,
	baseUrl?: string,
	clientId?: string,
	clientSecret?: string,
	code?: string,
	env?: string,
	got?: Got,
	hash?: string,
	interactiveLoginTimeout?: number,
	manual?: boolean,
	onOpenBrowser?: (p: { url: string }) => void,
	password?: string,
	persistSecrets?: boolean,
	platformUrl?: string,
	realm?: string,
	secretFile?: string,
	serviceAccount?: boolean,
	timeout?: number,
	username?: string
}

export interface LogoutOptions {
	accounts?: string | string[],
	all?: boolean,
	baseUrl?: string
}

export interface ServerInfo {

}

export interface ServerInfoOptions {
	baseUrl?: string,
	env?: string,
	realm?: string,
	url?: string
}

/**
 * Authenticates the machine and retreives the auth token.
 */
export default class Auth {
	baseUrl?: string;

	clientId?: string;

	clientSecret?: string;

	env: string;

	got!: Got;

	interactiveLoginTimeout?: number;

	password?: string;

	persistSecrets?: boolean;

	platformUrl?: string;

	realm?: string;

	secretFile?: string;

	serviceAccount?: boolean;

	/**
	 * The number of seconds before the access token expires and should be refreshed.
	 *
	 * @type {Number}
	 * @access private
	 */
	tokenRefreshThreshold: number = 0;

	/**
	 * The store to persist the token.
	 *
	 * @type {TokenStore}
	 * @access private
	 */
	tokenStore: TokenStore | null = null;

	username?: string;

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
	 * @param {Number} [opts.interactiveLoginTimeout] - The number of milliseconds to wait before
	 * timing out.
	 * @param {String} [opts.password] - The password used to authenticate. Requires a `username`.
	 * @param {Boolean} [opts.persistSecrets] - When `true`, adds the authenticator params
	 * (client secret, private key, username/password) to the authenticated account object so that
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
	 * @param {Boolean} [opts.serviceAccount=false] - When `true`, indicates authentication is being
	 * requested by a service instead of a user.
	 * @param {number} [opts.tokenRefreshThreshold=0] - The number of seconds before the access
	 * token expires and should be refreshed.
	 * @param {TokenStore} [opts.tokenStore] - A token store instance for persisting the tokens.
	 * @param {String} [opts.tokenStoreDir] - The directory where the token store is saved. Required
	 * when the `tokenStoreType` is `secure` or `file`.
	 * @param {String} [opts.tokenStoreType=secure] - The type of store to persist the access token.
	 * Possible values include: `auto`, `secure`, `file`, or `memory`. If value is `auto`, it will
	 * attempt to use `secure`, then `file`, then `memory`. If set to `null`, then it will not
	 * persist the access token.
	 * @param {String} [opts.username] - The username used to authenticate. Requires a `password`.
	 * @access public
	 */
	constructor(opts: AuthOptions = {}) {
		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		if (opts.tokenRefreshThreshold !== undefined) {
			let threshold = opts.tokenRefreshThreshold;
			if (typeof threshold === 'string') {
				threshold = parseInt(threshold, 10);
			}
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
			interactiveLoginTimeout: { value: opts.interactiveLoginTimeout },
			password:       { value: opts.password },
			realm:          { value: opts.realm },
			persistSecrets: { writable: true, value: opts.persistSecrets },
			platformUrl:    { value: opts.platformUrl },
			secretFile:     { value: opts.secretFile },
			serviceAccount: { value: opts.serviceAccount },
			username:       { value: opts.username }
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
					} catch (e: any) {
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
					} catch (e: any) {
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
	applyDefaults(opts: DefaultOptions = {}) {
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
			password:       opts.password || this.password,
			persistSecrets: opts.persistSecrets !== undefined ? opts.persistSecrets : this.persistSecrets,
			platformUrl:    opts.platformUrl || this.platformUrl,
			realm:          opts.realm || this.realm,
			secretFile:     opts.secretFile || this.secretFile,
			serviceAccount: opts.serviceAccount || this.serviceAccount,
			timeout:        opts.timeout || opts.interactiveLoginTimeout || this.interactiveLoginTimeout,
			tokenStore:     this.tokenStore,
			username:       opts.username || this.username
		};
	}

	/**
	 * Creates an authenticator based on the supplied options.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Authenticator} [opts.authenticator] - An authenticator instance to use. If not
	 * specified, one will be auto-selected based on the options.
	 * @param {String} [opts.clientSecret] - The secret token to use to authenticate.
	 * @param {String} [opts.password] - The password used to authenticate. Requires a `username`.
	 * @param {String} [opts.secretFile] - The path to the jwt secret file.
	 * @param {Boolean} [opts.serviceAccount=false] - When `true`, indicates authentication is being
	 * requested by a service instead of a user.
	 * @param {String} [opts.username] - The username used to authenticate. Requires a `password`.
	 * @returns {Authenticator}
	 * @access public
	 */
	createAuthenticator(opts: DefaultOptions = {}) {
		if (opts.authenticator) {
			if (!(opts.authenticator instanceof Authenticator)) {
				throw E.INVALID_ARUGMENT('Expected authenticator to be an Authenticator instance.');
			}
			log(`Using existing ${highlight(opts.authenticator.constructor.name)} authenticator`);
			return opts.authenticator;
		}

		if (opts.persistSecrets === undefined) {
			opts.persistSecrets = this.persistSecrets;
		}

		if (typeof opts.username === 'string' && opts.username && typeof opts.password === 'string') {
			log(`Creating ${highlight('OwnerPassword')} authenticator`);
			return new OwnerPassword(opts as OwnerPasswordOptions);
		}

		if (typeof opts.clientSecret === 'string' && opts.clientSecret) {
			log(`Creating ${highlight('ClientSecret')} authenticator`);
			return new ClientSecret(opts as ClientSecretOptions);
		}

		if (typeof opts.secretFile === 'string' && opts.secretFile) {
			log(`Creating ${highlight('SignedJWT')} authenticator`);
			return new SignedJWT(opts as SignedJWTOptions);
		}

		log(`Creating ${highlight('PKCE')} authenticator`);
		return new PKCE(opts as AuthenticatorOptions);
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
	async find(opts?: DefaultOptions | string) {
		if (opts === undefined) {
			opts = {};
		}

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

		const account: Account | null = await this.tokenStore.get(opts);
		if (!account) {
			return;
		}

		// copy over the correct auth params
		for (const prop of [ 'baseUrl', 'clientId', 'realm', 'env', 'clientSecret', 'username', 'password', 'secret' ]) {
			if (account.auth[prop as keyof AccountAuthInfo] &&
				opts[prop as keyof DefaultOptions] !== account.auth[prop as keyof AccountAuthInfo]) {

				log(`Overriding "${prop}" auth param with account's: ${opts[prop as keyof DefaultOptions]} -> ${account.auth[prop as keyof AccountAuthInfo]}`);
				opts[prop as keyof DefaultOptions] = account.auth[prop as keyof AccountAuthInfo] as any;
			}
		}
		authenticator = this.createAuthenticator(opts);

		const { access, refresh } = account.auth.expires;
		let doRefresh = account.auth.expired;
		if (doRefresh) {
			log(`Access token for account ${highlight(account.name || account.hash)} has expired`);
			if ((refresh || access) < Date.now()) {
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
				return await authenticator.getToken(null, null, true);
			} catch (err: any) {
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
		} catch (err: any) {
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
	async list(): Promise<Account[]> {
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
	 * @param {String} [opts.code] - The authentication code from a successful interactive login.
	 * @param {String} [opts.env=prod] - The environment name. Must be `staging` or `prod`.
	 * The environment is a shorthand way of specifying a Axway default base URL.
	 * @param {Boolean} [opts.manual=false] - When `true`, it will return the auth URL instead of
	 * launching the auth URL in the default browser.
	 * @param {Function} [opts.onOpenBrowser] - A callback when the web browser is about to be
	 * launched.
	 * @param {String} [opts.realm] - The name of the realm to authenticate with.
	 * @param {Number} [opts.timeout] - The number of milliseconds to wait before timing out.
	 * @returns {Promise<Object>} Resolves an object containing the access token, account name, and
	 * user info.
	 * @access public
	 */
	async login(opts: DefaultOptions = {}) {
		opts = this.applyDefaults(opts);
		const authenticator = this.createAuthenticator(opts);
		return await authenticator.login(opts);
	}

	/**
	 * Revokes all or specific authenticated accounts.
	 *
	 * @param {Object} [opts] - Required options.
	 * @param {Array.<String>} [opts.accounts] - A list of accounts names or hashes.
	 * @param {Boolean} [opts.all] - When `true`, revokes all accounts.
	 * @param {String} [opts.baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise<Array>} Resolves a list of revoked credentials.
	 * @access public
	 */
	async logout(opts: LogoutOptions = {}): Promise<Account[]> {
		if (!this.tokenStore) {
			log('No token store, returning empty array');
			return [];
		}

		const { all, baseUrl } = opts || {};
		let accounts: string[] = [];

		if (!all) {
			if (!opts.accounts){ 
				throw E.INVALID_ARGUMENT('Expected accounts to be a list of accounts');
			}
			if (typeof opts.accounts === 'string') {
				accounts = [ opts.accounts ];
			} else if (Array.isArray(opts.accounts)) {
				accounts = opts.accounts;
			} else {
				throw E.INVALID_ARGUMENT('Expected accounts to be a list of accounts');
			}
			if (!accounts.length) {
				return [];
			}
		}

		let revoked;
		if (all) {
			revoked = await this.tokenStore.clear(baseUrl);
		} else {
			revoked = await this.tokenStore.delete(accounts, baseUrl);
		}

		if (Array.isArray(revoked)) {
			for (const entry of revoked) {
				// don't logout of platform accounts here, it's done in the Amplify SDK by opening the browser
				if (!entry.isPlatform) {
					const url = `${getEndpoints(entry.auth).logout}?id_token_hint=${entry.auth.tokens.id_token}`;
					try {
						const { statusCode } = await this.got(url, { responseType: 'json', retry: { limit: 0 } });
						log(`Successfully logged out ${highlight(entry.name)} ${magenta(statusCode)} ${note(`(${entry.auth.baseUrl}, ${entry.auth.realm})`)}`);
					} catch (err: any) {
						log(`Failed to log out ${highlight(entry.name)} ${alert(err.status)} ${note(`(${entry.auth.baseUrl}, ${entry.auth.realm})`)}`);
					}
				}
			}
		}

		return revoked;
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
	async serverInfo(opts: ServerInfoOptions | undefined = {}): Promise<ServerInfo> {
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
			return (await this.got(url, { responseType: 'json', retry: { limit: 0 } })).body as ServerInfo;
		} catch (err: any) {
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
	async updateAccount(account: Account) {
		if (this.tokenStore) {
			await this.tokenStore.set(account);
		}
	}
}
