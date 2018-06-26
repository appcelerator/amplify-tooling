import Authenticator from './authenticator';
import crypto from 'crypto';

/**
 * Authentication scheme using a Proof Key for Code Exchange (PKCE) and an interactive login.
 */
export default class PKCE extends Authenticator {
	/**
	 * A random string used by the server when creating the auth code during interactive
	 * authentication and verified by the server when retrieving the access token.
	 * @type {String}
	 */
	codeVerifier = null;

	/**
	 * Initializes an PKCE authentication instance.
	 *
	 * @param {Object} opts - Various options.
	 * @access public
	 */
	constructor(opts) {
		super(opts);

		this.codeVerifier = crypto.randomBytes(32)
			.toString('base64')
			.replace(/\+/g, '.')
			.replace(/[=/]/g, '_');

		const codeChallenge = crypto.createHash('sha256')
			.update(this.codeVerifier)
			.digest('base64')
			.split('=')[0]
			.replace(/\+/g, '-')
			.replace(/\//g, '_');

		this.authorizationUrl = this.generateAuthorizationUrl({
			codeChallenge:       codeChallenge,
			codeChallengeMethod: 'S256',
			grantType:           Authenticator.GrantTypes.AuthorizationCode
		});

		this.interactive = true;
	}

	/**
	 * Parameters to include with authentication requests.
	 *
	 * @type {Object}
	 * @access private
	 */
	get getTokenParams() {
		return {
			codeVerifier: this.codeVerifier,
			grantType:    Authenticator.GrantTypes.AuthorizationCode
		};
	}
}
