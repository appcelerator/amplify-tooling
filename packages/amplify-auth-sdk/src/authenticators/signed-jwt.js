import Authenticator from './authenticator';
import E from '../errors';
import fs from 'fs';
import jws from 'jws';

import { v4 as uuidv4 } from 'uuid';

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
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		if (!opts.secretFile || typeof opts.secretFile !== 'string') {
			throw E.INVALID_ARGUMENT('Expected JWT secret key file to be a non-empty string');
		}

		super(opts);

		this.shouldFetchOrgs = false;

		Object.defineProperty(this, 'secretFile', { value: opts.secretFile });
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
			throw E.INVALID_FILE(`JWT secret key file does not exist: ${this.secretFile}`);
		}

		const issuedAt = Math.floor(Date.now() / 1000);

		return this.signedJWT = jws.sign({
			header:  { alg: 'RS256', typ: 'JWT' },
			payload: {
				aud: this.endpoints.token,
				exp: issuedAt + (60 * 60), // 1 hour (exp is in seconds)
				iat: issuedAt,
				iss: this.clientId,
				jti: uuidv4(),
				sub: this.clientId
			},
			secret:  fs.readFileSync(this.secretFile, 'utf8')
		});
	}

	/**
	 * Parameters to base the authenticator hash on.
	 *
	 * @type {Object}
	 * @access private
	 */
	get hashParams() {
		let secret = null;

		try {
			secret = fs.readFileSync(this.secretFile, 'utf8');
		} catch (e) {
			// squelch
		}

		return { secret };
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
			clientAssertionType: JWTAssertion
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
			clientAssertion:     this.getSignedJWT(),
			clientAssertionType: JWTAssertion,
			grantType:           ClientCredentials
		};
	}
}
