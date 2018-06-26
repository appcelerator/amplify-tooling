import Authenticator from './authenticator';
import fs from 'fs';
import jws from 'jws';

const { JWTAssertion, ClientCredentials } = Authenticator.GrantTypes;

/**
 * Authentication scheme using a JSON Web Token (JWT).
 */
export default class SignedJWT extends Authenticator {
	/**
	 * Initializes an PKCE authentication instance.
	 *
	 * @param {Object} opts - Various options.
	 * @param {String} opts.secretFile - The path to the jwt secret file.
	 * @access public
	 */
	constructor(opts) {
		if (!opts || typeof opts !== 'object') {
			const err = new TypeError('Expected options to be an object');
			err.code = 'INVALID_ARGUMENT';
			throw err;
		}

		if (!opts.secretFile || typeof opts.secretFile !== 'string') {
			const err = new TypeError('Expected JWT secret key file to be a non-empty string');
			err.code = 'INVALID_ARGUMENT';
			throw err;
		}

		super(opts);

		this.secretFile = opts.secretFile;
	}

	/**
	 * Generates the signed JWT.
	 *
	 * @returns {String}
	 * @access private
	 */
	getSignedJWT() {
		if (this.signedJWT) {
			return this.signedJWT;
		}

		try {
			fs.statSync(this.secretFile).isFile();
		} catch (e) {
			const err = new Error(`JWT secret key file does not exist: ${this.secretFile}`);
			err.code = 'INVALID_JWT_FILE';
			throw err;
		}

		const issuedAt = Math.floor(Date.now() / 1000);

		return this.signedJWT = jws.sign({
			header:  { alg: 'RS256', typ: 'JWT' },
			payload: {
				aud: this.endpoints.token,
				exp: issuedAt + (60 * 60 * 1000), // 1 hour
				iat: issuedAt,
				iss: this.clientId,
				sub: this.clientId
			},
			secret:  fs.readFileSync(this.secretFile, 'utf8')
		});
	}

	/**
	 * Parameters to include with authentication requests.
	 *
	 * @type {Object}
	 * @access private
	 */
	get getTokenParams() {
		return {
			clientAssertion:     this.getSignedJWT(),
			clientAssertionType: JWTAssertion,
			grantType:           ClientCredentials
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
			clientAssertion:     this.getSignedJWT(),
			clientAssertionType: JWTAssertion,
		};
	}

	/**
	 * Parameters to include with revoke requests.
	 *
	 * @type {?Object}
	 * @access private
	 */
	get revokeTokenParams() {
		return {
			clientAssertion:     this.getSignedJWT(),
			clientAssertionType: JWTAssertion,
		};
	}
}
