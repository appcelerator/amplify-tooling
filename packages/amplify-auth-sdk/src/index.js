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

import * as server from './server';

import { getServerInfo } from './util';

/**
 * Authenticates the machine and retreives the auth token.
 */
export default class Auth {
	/**
	 * The authenticator instance.
	 * @type {Authenticator}
	 */
	authenticator = null;

	/**
	 * Initializes the authentication instance.
	 *
	 * @param {Object} opts - Various options.
	 * @param {String} [opts.baseUrl] - The base URL to use for all outgoing requests.
	 * @param {String} opts.clientId - The client id to specify when authenticating.
	 * @param {String} [opts.env=prod] - The environment name. Must be `dev`, `preprod`, or `prod`.
	 * The environment is a shorthand way of specifying a Axway default base URL.
	 * @param {String} [opts.keytarServiceName="amplify-auth"] - The name of the consumer using this
	 * library when using the "keytar" token store.
	 * @param {String} opts.realm - The name of the realm to authenticate with.
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
	constructor(opts) {
		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		// create the authenticator
		if (typeof opts.username === 'string' && opts.username && typeof opts.password === 'string') {
			this.authenticator = new OwnerPassword(opts);
		} else if (typeof opts.clientSecret === 'string' && opts.clientSecret) {
			this.authenticator = new ClientSecret(opts);
		} else if (typeof opts.secretFile === 'string' && opts.secretFile) {
			this.authenticator = new SignedJWT(opts);
		} else {
			this.authenticator = new PKCE(opts);
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
		return this.authenticator.expiresIn;
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
	getAccessToken(doLogin) {
		return this.authenticator.getAccessToken(doLogin);
	}

	/**
	 * Returns a list of active access tokens.
	 *
	 * @returns {Promise<Array>}
	 * @access public
	 */
	async listTokens() {
		const { tokenStore } = this.authenticator;
		return tokenStore ? await tokenStore.list() : [];
	}

	/**
	 * Authenticates using the configured authenticator.
	 *
	 * @param {Object} [opts] - Various options.
	 * @returns {Promise<String>}
	 * @access public
	 */
	login(opts) {
		return this.authenticator.login(opts);
	}

	/**
	 * Invalidates the access token.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	// logout() {
	// 	return this.authenticator.logout();
	// }

	/**
	 * Revokes a list of specific account access tokens.
	 *
	 * @param {Array.<String>} [accounts] - A list of account email addresses.
	 * @returns {Promise}
	 * @access public
	 */
	static async revoke(opts, accounts) {
		//
	}

	/**
	 * Discovers available endpoints based on the remote server's OpenID configuration.
	 *
	 * @param {String} [url] - An optional URL to discover the available endpoints.
	 * @returns {Promise<Object>}
	 * @access public
	 */
	serverInfo(url) {
		return this.authenticator.serverInfo(url);
	}

	/**
	 * Discovers available endpoints based on the remote server's OpenID configuration.
	 *
	 * @param {String} url - The URL to discover the available endpoints.
	 * @returns {Promise<Object>}
	 * @access public
	 */
	static serverInfo(url) {
		return getServerInfo(url);
	}

	/**
	 * Retrieves the user info associated with the access token.
	 *
	 * @returns {Promise<Object>}
	 * @access public
	 */
	userInfo() {
		return this.authenticator.userInfo();
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
