import Authenticator from './authenticator';

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
			const err = new TypeError('Expected options to be an object');
			err.code = 'INVALID_ARGUMENT';
			throw err;
		}

		if (!opts.username || typeof opts.username !== 'string') {
			const err = new TypeError('Expected username to be a non-empty string');
			err.code = 'INVALID_ARGUMENT';
			throw err;
		}

		if (typeof opts.password !== 'string') {
			const err = new TypeError('Expected password to be a string');
			err.code = 'INVALID_ARGUMENT';
			throw err;
		}

		super(opts);

		this.username = opts.username;
		this.password = opts.password;
	}

	/**
	 * Parameters to include with authentication requests.
	 *
	 * @type {?Object}
	 * @access private
	 */
	get getTokenParams() {
		return {
			grantType: Authenticator.GrantTypes.Password,
			username:  this.username,
			password:  this.password
		};
	}
}
