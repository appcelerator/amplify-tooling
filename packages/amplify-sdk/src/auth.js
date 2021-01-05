import E from './errors';

import Authenticator from './authenticators/authenticator';
import ClientSecret from './authenticators/client-secret';
import OwnerPassword from './authenticators/owner-password';
import PKCE from './authenticators/pkce';
import SignedJWT from './authenticators/signed-jwt';

import FileStore from './stores/file-store';
import MemoryStore from './stores/memory-store';
import SecureStore from './stores/secure-store';
import TokenStore from './stores/token-store';

import getEndpoints from './endpoints';
import snooplogg from 'snooplogg';

import * as environments from './environments';
import * as request from '@axway/amplify-request';

const { log, warn } = snooplogg('amplify-sdk:auth');
const { alert, highlight, magenta, note } = snooplogg.styles;

/**
 * Authenticates the machine and retreives the auth token.
 */
export default class Auth {
	/**
	 * The store to persist the token.
	 *
	 * @type {TokenStore}
	 * @access private
	 */
	tokenStore = null;

	/**
	 * Initializes the authentication instance by setting the default settings and creating the
	 * token store.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {String} [opts.baseUrl] - The base URL to use for all outgoing requests.
	 * @param {String} [opts.clientId] - The client id to specify when authenticating.
	 * @param {String} [opts.clientSecret] - The secret token to use to authenticate.
	 * @param {String} [opts.env=prod] - The environment name. Must be `dev`, `preprod`, or `prod`.
	 * The environment is a shorthand way of specifying a Axway default base URL.
	 * @param {String} [opts.homeDir] - The path to the home directory containing the `lib`
	 * directory where `keytar` is located. This option is required when `tokenStoreType` is set to
	 * `secure`, which is the default.
	 * @param {String} [opts.orgSelectUrl] - The URL to redirect the browser to after the
	 * access token has been fetched.
	 * @param {String} [opts.password] - The password used to authenticate. Requires a `username`.
	 * @param {String} [opts.platformUrl] - The URL to redirect the browser to after a
	 * successful login.
	 * @param {String} [opts.realm] - The name of the realm to authenticate with.
	 * @param {Object} [opts.requestOptions] - An options object to pass into AMPLIFY CLI Utils to
	 * create the `got` HTTP client.
	 * @param {String} [opts.secretFile] - The path to the jwt secret file.
	 * @param {String} [opts.secureServiceName="Axway AMPLIFY Auth"] - The name of the consumer
	 * using this library when using the "secure" token store.
	 * @param {Boolean} [opts.serviceAccount=false] - When `true`, indicates authentication is being
	 * requested by a service instead of a user.
	 * @param {Boolean} [opts.tokenRefreshThreshold=0] - The number of seconds before the access
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
	constructor(opts = {}) {
		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		Object.defineProperties(this, {
			baseUrl:        { value: opts.baseUrl },
			clientId:       { value: opts.clientId },
			clientSecret:   { value: opts.clientSecret },
			env:            { value: opts.env },
			got:            { value: request.init(opts.requestOptions) },
			messages:       { value: opts.messages },
			password:       { value: opts.password },
			realm:          { value: opts.realm },
			platformUrl:    { value: opts.platformUrl },
			orgSelectUrl:   { value: opts.orgSelectUrl },
			secretFile:     { value: opts.secretFile },
			serviceAccount: { value: opts.serviceAccount },
			username:       { value: opts.username }
		});

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
	}

	/**
	 * Ensures the options contains the configurable settings. Validation is handled by the code
	 * requiring the values.
	 *
	 * @param {Object} [opts] - Various options.
	 * @returns {Object}
	 * @access private
	 */
	applyDefaults(opts = {}) {
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
			env:            name,
			messages:       opts.messages || this.messages,
			orgSelectUrl:   opts.orgSelectUrl || this.orgSelectUrl,
			password:       opts.password || this.password,
			platformUrl:    opts.platformUrl || this.platformUrl,
			realm:          opts.realm || this.realm,
			secretFile:     opts.secretFile || this.secretFile,
			serviceAccount: opts.serviceAccount || this.serviceAccount,
			tokenStore:     this.tokenStore,
			username:       opts.username || this.username
		};
	}

	/**
	 * Creates an authetnicator based on the supplied options.
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
	createAuthenticator(opts = {}) {
		if (opts.authenticator) {
			if (!(opts.authenticator instanceof Authenticator)) {
				throw E.INVALID_ARUGMENT('Expected authenticator to be an Authenticator instance.');
			}
			log(`Using existing ${highlight(opts.authenticator.constructor.name)} authenticator`);
			return opts.authenticator;
		}

		if (typeof opts.username === 'string' && opts.username && typeof opts.password === 'string') {
			log(`Creating ${highlight('OwnerPassword')} authenticator`);
			return new OwnerPassword(opts);
		}

		if (typeof opts.clientSecret === 'string' && opts.clientSecret) {
			log(`Creating ${highlight('ClientSecret')} authenticator`);
			return new ClientSecret(opts);
		}

		if (typeof opts.secretFile === 'string' && opts.secretFile) {
			log(`Creating ${highlight('SignedJWT')} authenticator`);
			return new SignedJWT(opts);
		}

		log(`Creating ${highlight('PKCE')} authenticator`);
		return new PKCE(opts);
	}

	/**
	 * Retrieves the access token. If the authenticator is interactive and the authenticator has not
	 * yet authenticated with the server, an error is thrown.
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
	async find(opts = {}) {
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
		for (const prop of [ 'baseUrl', 'clientId', 'realm', 'env' ]) {
			if (account.auth[prop] && opts[prop] !== account.auth[prop]) {
				log(`Overriding "${prop}" auth param with account's: ${opts[prop]} -> ${account.auth[prop]}`);
				opts[prop] = account.auth[prop];
			}
		}
		authenticator = this.createAuthenticator(opts);

		if (account.auth.expired) {
			// refresh the access token if the refresh token is valid
			log(`Access token for account ${highlight(account.name || account.hash)} has expired`);

			if (account.auth.expires.refresh < Date.now()) {
				log(`Unable to refresh access token for account ${highlight(account.name || account.hash)} because refresh token is also expired`);
				return;
			}

			try {
				log(`Refreshing access token for account ${highlight(account.name || account.hash)}`);
				return await authenticator.getToken();
			} catch (err) {
				if (err.code === 'EINVALIDGRANT') {
					warn(err.message);
					log(`Removing invalid account ${highlight(account.name || account.hash)} due to invalid refresh token`);
					await this.tokenStore.delete(account.name, opts.baseUrl);
					return null;
				}
				throw err;
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
			return await this.tokenStore.list();
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
	 * @param {String} [opts.env=prod] - The environment name. Must be `dev`, `preprod`, or `prod`.
	 * The environment is a shorthand way of specifying a Axway default base URL.
	 * @param {Boolean} [opts.manual=false] - When `true`, it will return the auth URL instead of
	 * launching the auth URL in the default browser.
	 * @param {String} [opts.realm] - The name of the realm to authenticate with.
	 * @param {Number} [opts.timeout] - The number of milliseconds to wait before timing out.
	 * @returns {Promise<Object>} Resolves an object containing the access token, account name, and
	 * user info.
	 * @access public
	 */
	async login(opts = {}) {
		opts = this.applyDefaults(opts);
		const authenticator = this.createAuthenticator(opts);
		return await authenticator.login(opts);
	}

	/**
	 * Revokes all or specific authenticated accounts.
	 *
	 * @param {Object} opts - Required options.
	 * @param {Array.<String>|String} opts.accounts - A list of accounts names.
	 * @param {Boolean} opts.all - When `true`, revokes all accounts.
	 * @param {String} [opts.baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise<Array>} Resolves a list of revoked credentials.
	 * @access public
	 */
	async logout({ accounts, all, baseUrl } = {}) {
		if (!this.tokenStore) {
			log('No token store, returning empty array');
			return [];
		}

		if (!all && typeof accounts !== 'string' && !Array.isArray(accounts)) {
			throw E.INVALID_ARGUMENT('Expected accounts to be "all" or a list of accounts');
		}

		if (!all && !accounts.length) {
			return [];
		}

		let revoked;
		if (all) {
			revoked = await this.tokenStore.clear(baseUrl);
		} else {
			revoked = await this.tokenStore.delete(accounts, baseUrl);
		}

		if (Array.isArray(revoked)) {
			for (const entry of revoked) {
				const url = `${getEndpoints(entry.auth).logout}?id_token_hint=${entry.auth.tokens.id_token}`;
				try {
					const { statusCode } = await this.got(url, { responseType: 'json', retry: 0 });
					log(`Successfully logged out ${highlight(entry.name)} ${magenta(statusCode)} ${note(`(${entry.auth.baseUrl}, ${entry.auth.realm})`)}`);
				} catch (err) {
					log(`Failed to log out ${highlight(entry.name)} ${alert(err.status)} ${note(`(${entry.auth.baseUrl}, ${entry.auth.realm})`)}`);
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
	 * @param {String} [opts.env=prod] - The environment name. Must be `dev`, `preprod`, or `prod`.
	 * The environment is a shorthand way of specifying a Axway default base URL.
	 * @param {String} [opts.realm] - The name of the realm to authenticate with.
	 * @param {String} [opts.url] - An optional URL to discover the available endpoints.
	 * @returns {Promise<Object>}
	 * @access public
	 */
	async serverInfo(opts = {}) {
		opts = this.applyDefaults(opts);

		let { url } = opts;

		if (!url) {
			url = getEndpoints(opts).wellKnown;
		}

		if (!url || typeof url !== 'string') {
			throw E.INVALID_ARGUMENT('Expected URL to be a non-empty string');
		}

		try {
			log(`Fetching server info: ${url}...`);
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
