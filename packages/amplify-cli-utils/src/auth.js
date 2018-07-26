import Auth from '@axway/amplify-auth-sdk';
import loadConfig from './config';

/**
 * The default authentication client id.
 *
 * @type {String}
 */
const clientId = 'amplify-cli';

/**
 * The default authentication realm.
 *
 * @type {String}
 */
const realm = 'Axway';

/**
 * Logs into the Axway platform and returns the user information.
 *
 * @param {Object} opts - User option overrides.
 * @returns {Promise<Object>}
 */
export async function login(opts = {}) {
	const auth = new Auth(buildParams(opts));
	await auth.login();
	return await auth.userinfo();
}

/**
 * Invalidates the access tokens.
 *
 * @param {Object} opts - User option overrides.
 * @returns {Promise}
 */
export async function logout(opts = {}) {
	const auth = new Auth(buildParams(opts));
	await auth.logout();
}

/**
 * Constructs a parameters object to pass into an Auth instance.
 *
 * @param {Object} opts - User option overrides.
 * @returns {Object}
 */
function buildParams(opts) {
	if (opts && typeof opts !== 'object') {
		throw new Error('Expected options to be an object');
	}

	const config = loadConfig();
	const params = {};
	const props = {
		baseUrl:      undefined,
		clientId,
		clientSecret: undefined,
		env:          undefined,
		password:     undefined,
		realm,
		secretFile:   undefined,
		username:     undefined
	};

	for (const prop of Object.keys(props)) {
		params[prop] = opts[prop] || config.get(`auth.${prop}`, props[prop]);
	}

	return params;
}
