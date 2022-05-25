import Authenticator, { AuthenticatorParams } from './authenticator.js';
import crypto from 'crypto';

interface PKCEParams extends AuthenticatorParams {}

/**
 * Authentication scheme using a Proof Key for Code Exchange (PKCE) and an interactive login.
 */
export default class PKCE extends Authenticator {
	/**
	 * A random string used by the server when creating the auth code during interactive
	 * authentication and verified by the server when retrieving the access token.
	 * @type {String}
	 */
	codeVerifier: string | null = null;

	/**
	 * Initializes an PKCE authentication instance.
	 *
	 * @param {Object} opts - Various options.
	 * @access public
	 */
	constructor(opts: PKCEParams) {
		super(opts);

		this.codeVerifier = crypto.randomBytes(32)
			.toString('base64')
			.replace(/\+/g, '.')
			.replace(/[=/]/g, '_');

		this.interactive = true;
	}

	/**
	 * Parameters to include in the interactive authorization URL.
	 *
	 * @type {Object}
	 * @access private
	 */
	get authorizationUrlParams(): { codeChallenge: string, codeChallengeMethod: string, grantType: string } {
		const codeChallenge = crypto.createHash('sha256')
			.update(this.codeVerifier as string)
			.digest('base64')
			.split('=')[0]
			.replace(/\+/g, '-')
			.replace(/\//g, '_');

		return {
			codeChallenge:       codeChallenge,
			codeChallengeMethod: 'S256',
			grantType:           Authenticator.GrantTypes.AuthorizationCode
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
			codeVerifier: this.codeVerifier,
			grantType:    Authenticator.GrantTypes.AuthorizationCode
		};
	}
}
