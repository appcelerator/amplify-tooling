import Authenticator, { AuthenticatorParams } from './authenticator.js';
import E from '../errors.js';
import fs from 'fs';
import jws from 'jws';

import { isFile } from '@axway/amplify-utils';
import { v4 as uuidv4 } from 'uuid';

const { JWTAssertion, ClientCredentials } = Authenticator.GrantTypes;

interface SignedJWTParams extends AuthenticatorParams {
    secret?: string;
    secretFile?: string;
}

/**
 * Authentication scheme using a JSON Web Token (JWT).
 */
export default class SignedJWT extends Authenticator {
	shouldFetchOrgs: boolean;
	signedJWT?: string;

	/**
	 * Initializes an PKCE authentication instance.
	 *
	 * @param {Object} opts - Various options.
	 * @param {String} [opts.secret] - The private key when `secretFile` is not set.
	 * @param {String} [opts.secretFile] - The path to the private key file when `secret` is not set.
	 * @access public
	 */
	constructor(opts?: SignedJWTParams) {
		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		let { secret, secretFile } = opts;

		if (!secret && !secretFile) {
			throw E.INVALID_ARGUMENT('Expected either a private key or private key file to be an object');
		} else if (secret !== undefined && typeof secret !== 'string') {
			throw E.INVALID_ARGUMENT('Expected private key to be a string');
		} else if (secretFile !== undefined) {
			if (typeof secretFile !== 'string') {
				throw E.INVALID_ARGUMENT('Expected private key file path to be a string');
			}
			if (!fs.existsSync(secretFile)) {
				throw new Error(`Specified private key file does not exist: ${secretFile}`);
			}
			if (!isFile(secretFile)) {
				throw new Error(`Specified private key is not a file: ${secretFile}`);
			}
			secret = fs.readFileSync(secretFile, 'utf-8');
		}

		super(opts);

		this.shouldFetchOrgs = false;

		if (!secret || !/^-----BEGIN (RSA )?PRIVATE KEY-----/.test(secret)) {
			throw new Error(`Private key file ${opts.secretFile} is not a PEM formatted file`);
		}
		Object.defineProperty(this, 'secret', { value: secret });
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

		const issuedAt = Math.floor(Date.now() / 1000);

		try {
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
				secret:  this.secret
			});
		} catch (err) {
			err.message = `Bad secret file "${this.secretFile}" (${err.message})`;
			throw err;
		}
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
			secret: this.secret
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
			secret: this.secret
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
