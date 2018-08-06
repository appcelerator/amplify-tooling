import Auth from '@axway/amplify-auth-sdk';
import loadConfig from './config';

/**
 * Environment specific auth settings.
 *
 * @type {Object}
 */
export const environments = {
	dev: {
		clientId: 'cli-test-public',
		realm: 'Axway'
	},
	preprod: {
		clientId: 'cli-test-public',
		realm: 'AppcID'
	},
	prod: {
		clientId: 'cli',
		realm: 'Axway'
	}
};

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
	const env = opts.env || config.get('env') || 'prod';
	if (!environments.hasOwnProperty(env)) {
		throw new Error(`Invalid environment "${env}", expected ${Object.keys(environments).reduce((p, s, i, a) => `${p}"${s}"${i + 1 < a.length ? `, ${i + 2 === a.length ? 'or ' : ''}` : ''}`, '')}`);
	}

	const { clientId, realm } = environments[env];
	const params = {};
	const props = {
		baseUrl:      undefined,
		clientId,
		clientSecret: undefined,
		env,
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
