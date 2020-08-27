/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import AmplifySDK from '@axway/amplify-sdk';
import { ansi } from 'cli-kit';
import * as environments from './environments';
import * as locations from './locations';

export {
	AmplifySDK,
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
		platformUrl:             undefined,
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
 * @param {Array.<String>} head - One or more headings.
 * @param {Number} [indent] - The number of spaces to indent the table.
 * @returns {Table}
 */
export function createTable(head, indent = 0) {
	const Table = require('cli-table3');
	return new Table({
		chars: {
			bottom: '', 'bottom-left': '', 'bottom-mid': '', 'bottom-right': '',
			left: ' '.repeat(indent), 'left-mid': '',
			mid: '', 'mid-mid': '', middle: '  ',
			right: '', 'right-mid': '',
			top: '', 'top-left': '', 'top-mid': '', 'top-right': ''
		},
		head: Array.isArray(head) ? head.map(ansi.toUpperCase) : head,
		style: {
			head: [],
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
 * @param {Object} [opts] - Various options. See `@axway/amplify-config` for more details.
 * @returns {Config}
 */
export function loadConfig(opts) {
	return require('@axway/amplify-config').default(opts);
}
