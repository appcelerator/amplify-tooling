/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import E from './errors';

import Authenticator from './authenticators/authenticator';
import ClientSecret from './authenticators/client-secret';
import OwnerPassword from './authenticators/owner-password';
import PKCE from './authenticators/pkce';
import SignedJWT from './authenticators/signed-jwt';

import FileStore from './stores/file-store';
import KeytarStore from './stores/keytar-store';
import TokenStore from './stores/token-store';

import environments from './environments';
import fetch from 'node-fetch';
import getEndpoints from './endpoints';
import snooplogg from 'snooplogg';
import * as server from './server';

import { getServerInfo } from './util';

const { log } = snooplogg('amplify-auth');
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
	 * @param {Object} opts - Various options.
	 * @param {String} [opts.baseUrl] - The base URL to use for all outgoing requests.
	 * @param {String} [opts.clientId] - The client id to specify when authenticating.
	 * @param {String} [opts.env=prod] - The environment name. Must be `dev`, `preprod`, or `prod`.
	 * The environment is a shorthand way of specifying a Axway default base URL.
	 * @param {String} [opts.keytarServiceName="Axway amplify-auth-sdk"] - The name of the consumer
	 * using this library when using the "keytar" token store.
	 * @param {String} [opts.realm] - The name of the realm to authenticate with.
	 * @param {Boolean} [opts.tokenRefreshThreshold=0] - The number of seconds before the access
	 * token expires and should be refreshed.
	 * @param {TokenStore} [opts.tokenStore] - A token store instance for persisting the tokens.
	 * @param {String} [opts.tokenStoreDir] - The directory to save the token file when the
	 * `default` token store is used.
	 * @param {String} [opts.tokenStoreType=auto] - The type of store to persist the access token.
	 * Possible values include: `auto` (which tries to use the `keytar` store, but falls back to the
	 * default store), `keytar` to use the operating system's secure storage mechanism (or errors if
	 * keytar is not installed), or `default` to use the built-in store. If `null`, it will not
	 * persist the access token.
	 * @access public
	 */
	constructor(opts = {}) {
		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		this.baseUrl    = opts.baseUrl;
		this.clientId   = opts.clientId;
		this.env        = opts.env;
		this.realm      = opts.realm;

		if (opts.tokenStore) {
			if (!(opts.tokenStore instanceof TokenStore)) {
				throw E.INVALID_PARAMETER('Expected the token store to be a "TokenStore" instance');
			}
			this.tokenStore = opts.tokenStore;
		} else {
			const tokenStoreType = opts.tokenStoreType === undefined ? 'auto' : opts.tokenStoreType;
			switch (tokenStoreType) {
				case 'auto':
				case 'keytar':
					try {
						this.tokenStore = new KeytarStore(opts);
						break;
					} catch (e) {
						/* istanbul ignore if */
						if (tokenStoreType === 'keytar') {
							throw e;
						}

						// let 'auto' fall through
					}

				case 'default':
					// default file store
					this.tokenStore = new FileStore(opts);
			}
		}
	}

	/**
	 * Ensures the options contains the configurable settings. Validation is handled by the code
	 * requiring the values.
	 *
	 * @param {Object} [opts] - Various options.
	 * @access private
	 */
	applyDefaults(opts = {}) {
		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		const env = opts.env || this.env || 'prod';
		if (!environments[env]) {
			throw E.INVALID_VALUE(`Invalid environment: ${opts.env || this.env}`);
		}

		opts.baseUrl    = opts.baseUrl || this.baseUrl || environments[env].baseUrl;
		opts.clientId   = opts.clientId || this.clientId;
		opts.env        = env;
		opts.tokenStore = this.tokenStore;
		opts.realm      = opts.realm || this.realm;
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
	// getAccessToken(doLogin) {
	// 	return null; // this.authenticator.getAccessToken(doLogin);
	// }

	// TODO: need function that takes an account (email) and returns the token/info!!

	/**
	 * Returns a list of active access tokens.
	 *
	 * @returns {Promise<Array>}
	 * @access public
	 */
	list() {
		return this.tokenStore.list();
	}

	/**
	 * Authenticates using the configured authenticator.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {String|Array.<String>} [opt.app] - Specify the app to open the `target` with, or an
	 * array with the app and app arguments.
	 * @param {String} [opts.baseUrl] - The base URL to use for all outgoing requests.
	 * @param {String} [opts.clientId] - The client id to specify when authenticating.
	 * @param {String} [opts.code] - The authentication code from a successful interactive login.
	 * @param {String} [opts.env=prod] - The environment name. Must be `dev`, `preprod`, or `prod`.
	 * The environment is a shorthand way of specifying a Axway default base URL.
	 * @param {Boolean} [opts.manual=false] - When `true`, it will return the auth URL instead of
	 * launching the auth URL in the default browser.
	 * @param {String} [opts.realm] - The name of the realm to authenticate with.
	 * @param {Number} [opts.timeout] - The number of milliseconds to wait before timing out.
	 * Defaults to the `interactiveLoginTimeout` property.
	 * @param {Boolean} [opts.wait=false] - Wait for the opened app to exit before fulfilling the
	 * promise. If `false` it's fulfilled immediately when opening the app.
	 * @returns {Promise<Authenticator>}
	 * @access public
	 */
	async login(opts) {
		this.applyDefaults(opts);

		// create the authenticator
		let authenticator;
		if (typeof opts.username === 'string' && opts.username && typeof opts.password === 'string') {
			authenticator = new OwnerPassword(opts);
		} else if (typeof opts.clientSecret === 'string' && opts.clientSecret) {
			authenticator = new ClientSecret(opts);
		} else if (typeof opts.secretFile === 'string' && opts.secretFile) {
			authenticator = new SignedJWT(opts);
		} else {
			authenticator = new PKCE(opts);
		}

		return await authenticator.login(opts);
	}

	/**
	 * Revokes all or specific authenticated accounts.
	 *
	 * @param {Object} params - Required parameters.
	 * @param {String|Array.<String>} params.accounts - The word `all` or a list of accounts (email
	 * addresses).
	 * @param {String} [params.baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise<Array>} Returns a list of revoked credentials.
	 * @access public
	 */
	async revoke({ accounts, baseUrl }) {
		const revoked = [];

		if (baseUrl) {
			baseUrl = baseUrl.replace(/^.*\/\//, '');
		}

		if (accounts !== 'all' && !Array.isArray(accounts)) {
			throw E.INVALID_ARGUMENT('Expected accounts to be "all" or a list of accounts');
		}

		for (const entry of await this.tokenStore.list()) {
			if ((accounts === 'all' || accounts.includes(entry.email)) && (!baseUrl || entry.baseUrl === baseUrl)) {
				revoked.push(entry);

				await this.tokenStore.delete(entry.email, entry.baseUrl);

				const url = `${getEndpoints(entry).logout}?id_token_hint=${entry.tokens.id_token}`;
				const res = await fetch(url);
				if (res.ok) {
					log(`Successfully logged out ${highlight(entry.email)} ${magenta(res.status)} ${note(`(${entry.baseUrl}, ${entry.realm})`)}`);
				} else {
					log(`Failed to log out ${highlight(entry.email)} ${alert(res.status)} ${note(`(${entry.baseUrl}, ${entry.realm})`)}`);
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
	serverInfo(opts) {
		this.applyDefaults(opts);

		let { url } = opts;

		if (!url) {
			url = getEndpoints(opts).wellKnown;
		}

		return getServerInfo(url);
	}
}

export {
	Auth,

	Authenticator,
	ClientSecret,
	OwnerPassword,
	PKCE,
	SignedJWT,

	FileStore,
	KeytarStore,
	TokenStore,

	server
};
