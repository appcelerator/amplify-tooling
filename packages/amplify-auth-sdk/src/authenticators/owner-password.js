import Authenticator from './authenticator';
import E from '../errors';

/**
 * Authentication scheme using a username and password.
 */
export default class OwnerPassword extends Authenticator {
	/**
	 * Initializes an owner password authentication instance.
	 *
	 * @param {Object} opts - Various options.
	 * @param {String} opts.username - The username used to authenticate.
	 * @param {String} opts.password - The password used to authenticate.
	 * @access public
	 */
	constructor(opts) {
		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		if (!opts.username || typeof opts.username !== 'string') {
			throw E.INVALID_ARGUMENT('Expected username to be a non-empty string');
		}

		if (typeof opts.password !== 'string') {
			throw E.INVALID_ARGUMENT('Expected password to be a string');
		}

		super(opts);

		this.username = opts.username;
		this.password = opts.password;
	}

	/**
	 * Parameters to base the authenticator hash on.
	 *
	 * @type {Object}
	 * @access private
	 */
	get hashParams() {
		return {
			username: this.username,
			password: this.password
		};
	}

	/**
	 * Parameters to include with authentication requests.
	 *
	 * @type {?Object}
	 * @access private
	 */
	get tokenParams() {
		return {
			grantType: Authenticator.GrantTypes.Password,
			username:  this.username,
			password:  this.password
		};
	}
}
