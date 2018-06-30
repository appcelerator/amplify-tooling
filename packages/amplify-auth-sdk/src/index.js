/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Authenticator from './authenticators/authenticator';
import ClientSecret from './authenticators/client-secret';
import OwnerPassword from './authenticators/owner-password';
import PKCE from './authenticators/pkce';
import SignedJWT from './authenticators/signed-jwt';

import { getServerInfo } from './util';

const internal = {
	Authenticator,
	ClientSecret,
	OwnerPassword,
	PKCE,
	SignedJWT
};

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
	 * @param {String} opts.realm - The name of the realm to authenticate with.
	 * @access public
	 */
	constructor(opts) {
		if (!opts || typeof opts !== 'object') {
			const err = new TypeError('Expected options to be an object');
			err.code = 'INVALID_ARGUMENT';
			throw err;
		}

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
	 * Authenticates with the server and retrieves the access and refresh tokens.
	 *
	 * @param {String} [code] - When present, adds the code to the payload along with a redirect
	 * URL.
	 * @returns {Promise<String>} Resolves the access token.
	 * @access public
	 */
	getToken(code) {
		return this.authenticator.getToken(code);
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
	logout() {
		return this.authenticator.logout();
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
	internal
};
