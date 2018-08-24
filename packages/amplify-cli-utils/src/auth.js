import Auth from '@axway/amplify-auth-sdk';
import environments from './environments';
import loadConfig from './config';
import path from 'path';

import { axwayHome } from './locations';

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

	const { clientId, realm } = environments[env].auth;
	const params = {};
	const props = {
		baseUrl:                 undefined,
		clientId,
		clientSecret:            undefined,
		env,
		interactiveLoginTimeout: undefined,
		password:                undefined,
		realm,
		secretFile:              undefined,
		serverHost:              undefined,
		serverPort:              undefined,
		tokenRefreshThreshold:   undefined,
		tokenStoreDir:           axwayHome,
		tokenStoreType:          undefined,
		username:                undefined
	};

	for (const prop of Object.keys(props)) {
		params[prop] = opts[prop] || config.get(`auth.${prop}`, props[prop]);
	}

	return params;
}
