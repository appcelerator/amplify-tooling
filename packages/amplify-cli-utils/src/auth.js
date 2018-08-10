import Auth from '@axway/amplify-auth-sdk';
import environments from './environments';
import loadConfig from './config';

export { Auth };

/**
 * Constructs a parameters object to pass into an Auth instance.
 *
 * @param {Object} [opts] - User option overrides.
 * @param {Config} [config] - The AMPLIFY config object.
 * @returns {Object}
 */
export function buildParams(opts = {}, config) {
	if (opts && typeof opts !== 'object') {
		throw new Error('Expected options to be an object');
	}

	if (!config) {
		config = loadConfig();
	}

	const env = opts.env || config.get('env') || 'prod';
	if (!environments.hasOwnProperty(env)) {
		throw new Error(`Invalid environment "${env}", expected ${Object.keys(environments).reduce((p, s, i, a) => `${p}"${s}"${i + 1 < a.length ? `, ${i + 2 === a.length ? 'or ' : ''}` : ''}`, '')}`);
	}

	const { clientId, realm } = environments[env];
	const params = {};
	const props = {
		baseUrl:               undefined,
		clientId,
		clientSecret:          undefined,
		env,
		keytarServiceName: 'Axway AMPLIFY CLI',
		password:              undefined,
		realm,
		secretFile:            undefined,
		tokenRefreshThreshold: undefined,
		tokenStoreDir:         undefined,
		tokenStoreType:        undefined,
		username:              undefined
	};

	for (const prop of Object.keys(props)) {
		params[prop] = opts[prop] || config.get(`auth.${prop}`, props[prop]);
	}

	return params;
}
