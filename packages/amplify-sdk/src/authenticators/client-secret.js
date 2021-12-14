import Authenticator from './authenticator';
import E from '../errors';

const { AuthorizationCode, ClientCredentials } = Authenticator.GrantTypes;

/**
 * Authentication scheme using a pre-shared secret token. By default, the authentication process is
 * interactive unless it is a service account.
 */
export default class ClientSecret extends Authenticator {
	/**
	 * Initializes an client secret authentication instance.
	 *
	 * @param {Object} opts - Various options.
	 * @param {String} opts.clientSecret - The secret token to use to authenticate.
	 * @param {Boolean} [opts.serviceAccount=false] - When `true`, indicates authentication is being
	 * requested by a service instead of a user.
	 * @access public
	 */
	constructor(opts) {
		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		if (!opts.clientSecret || typeof opts.clientSecret !== 'string') {
			throw E.INVALID_ARGUMENT('Expected client secret to be a non-empty string');
		}

		super(opts);

		this.shouldFetchOrgs = !opts.serviceAccount;

		Object.defineProperty(this, 'clientSecret', { value: opts.clientSecret });
	}

	/**
	 * Parameters to include in the authenticated account object. Note that these values are
	 * stripped when the Amplify SDK returns the account object.
	 *
	 * @type {Object}
	 * @access private
	 */
	get authenticatorParams() {
		return {
			clientSecret: this.clientSecret
		};
	}

	/**
	 * Parameters to include in the interactive authorization URL.
	 *
	 * @type {Object}
	 * @access private
	 */
	get authorizationUrlParams() {
		return {
			grantType: this.interactive ? AuthorizationCode : ClientCredentials
		};
	}

	/**
	 * Parameters to base the authenticator hash on.
	 *
	 * @type {Object}
	 * @access private
	 */
	get hashParams() {
		return {
			clientSecret: this.clientSecret
		};
	}

	/**
	 * Parameters to include with authentication requests.
	 *
	 * @type {Object}
	 * @access private
	 */
	get tokenParams() {
		return {
			clientSecret: this.clientSecret,
			grantType:    this.interactive ? AuthorizationCode : ClientCredentials
		};
	}

	/**
	 * Parameters to include with refresh requests.
	 *
	 * @type {Object}
	 * @access private
	 */
	get refreshTokenParams() {
		return {
			clientSecret: this.clientSecret
		};
	}
}
