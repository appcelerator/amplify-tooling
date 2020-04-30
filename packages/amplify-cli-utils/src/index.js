/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import * as environments from './environments';
import * as locations from './locations';

export {
	environments,
	locations
};

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

	const env = environments.resolve(opts.env || config.get('env'));

	const { clientId, realm } = env.auth;
	const params = {};
	const props = {
		baseUrl:                 undefined,
		clientId,
		clientSecret:            undefined,
		env:                     env.name,
		interactiveLoginTimeout: undefined,
		homeDir:                 locations.axwayHome,
		password:                undefined,
		realm,
		secretFile:              undefined,
		serverHost:              undefined,
		serverPort:              undefined,
		tokenRefreshThreshold:   undefined,
		tokenStore:              undefined,
		tokenStoreDir:           locations.axwayHome,
		tokenStoreType:          undefined,
		username:                undefined
	};

	for (const prop of Object.keys(props)) {
		params[prop] = opts[prop] || config.get(`auth.${prop}`, props[prop]);
	}

	return params;
}

/**
 * Creates a table with default styles and padding.
 *
 * @param {...String} head - One or more headings.
 * @returns {Table}
 */
export function createTable(...head) {
	const Table = require('cli-table3');
	return new Table({
		chars: {
			bottom: '', 'bottom-left': '', 'bottom-mid': '', 'bottom-right': '',
			left: '', 'left-mid': '',
			mid: '', 'mid-mid': '', middle: '  ',
			right: '', 'right-mid': '',
			top: '', 'top-left': '', 'top-mid': '', 'top-right': ''
		},
		head,
		style: {
			head: [ 'bold' ],
			'padding-left': 0,
			'padding-right': 0
		}
	});
}

/**
 * Loads the config and creates an AMPLIFY SDK object, then returns both of them.
 *
 * @param {Object} [opts] - SDK options including `env` and auth options.
 * @param {Object} [config] - The AMPLIFY config. If not passed in, the config file is loaded.
 * @returns {Object} Returns an object containing the AMPLIFY CLI config and an initialized
 * AMPLIFY SDK instance.
 */
export function initSDK(opts = {}, config) {
	const AmplifySDK = require('@axway/amplify-sdk').default;

	if (!config) {
		config = loadConfig();
	}

	return {
		config,
		sdk: new AmplifySDK(buildParams(opts, config))
	};
}

/**
 * Loads the AMPLIFY CLI config file using the lazy loaded AMPLIFY Config package.
 *
 * @returns {Config}
 */
export function loadConfig() {
	return require('@axway/amplify-config').default();
}
