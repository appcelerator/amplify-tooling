/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import AmplifySDK from '@axway/amplify-sdk';
import fs from 'fs';
import { ansi } from 'cli-kit';
import * as environments from './environments';
import * as locations from './locations';
import * as request from '@axway/amplify-request';

export {
	AmplifySDK,
	environments,
	locations,
	request
};

/**
 * Constructs a parameters object to pass into an Auth instance.
 *
 * @param {Object} [opts] - User option overrides.
 * @param {Config} [config] - The AMPLIFY config object.
 * @returns {Object}
 */
export function buildAuthParams(opts = {}, config) {
	if (!opts || typeof opts !== 'object') {
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
		serviceAccount:          undefined,
		tokenRefreshThreshold:   undefined,
		tokenStore:              undefined,
		tokenStoreDir:           locations.axwayHome,
		tokenStoreType:          undefined,
		username:                undefined
	};

	for (const prop of Object.keys(props)) {
		params[prop] = opts[prop] || config.get(`auth.${prop}`, props[prop]);
	}

	params.requestOptions = createRequestOptions(config);

	return params;
}

// `buildParams()` is too ambiguous, so it was renamed to `buildAuthParams()`, but we still need to
// maintain backwards compatibility
export { buildAuthParams as buildParams };

/**
 * Builds an array of AMPLIFY CLI network settings for use as command line arguments when spawning
 * `npm`.
 *
 * @param {Object} [opts] - Request configuration options to override the AMPLIFY CLI config
 * settings.
 * @param {Config} [config] - An AMPLIFY Config instance. If not specified, the config is loaded
 * from disk.
 * @returns {Array.<String>}
 */
export function createNPMRequestArgs(opts, config) {
	const { ca, cert, key, proxy, strictSSL } = createRequestOptions(opts, config);
	const args = [];

	if (ca) {
		args.push('--ca', ca.toString());
	}
	if (cert) {
		args.push('--cert', cert.toString());
	}
	if (proxy) {
		args.push('--https-proxy', proxy);
	}
	if (key) {
		args.push('--key', key.toString());
	}
	args.push('--strict-ssl', String(strictSSL !== false));

	return args;
}

/**
 * Load the config file and initializes a `got` instance for making HTTP calls using the network
 * settings from the AMPLIFY CLI config file.
 *
 * @param {Object} [opts] - `got` option to override the AMPLIFY CLI config settings.
 * @param {Config} [config] - An AMPLIFY Config instance. If not specified, the config is loaded
 * from disk.
 * @returns {Function}
 */
export function createRequestClient(opts, config) {
	opts = createRequestOptions(opts, config);
	return request.init({
		...opts,
		https: {
			certificate: opts.cert,
			key: opts.key,
			...opts.https
		}
	});
}

/**
 * Loads the AMPLIFY CLI config file and construct the options for the various Node.js HTTP clients
 * including `pacote`, `npm-registry-fetch`, `make-fetch-happen`, and `request`.
 *
 * @param {Object} [opts] - Request configuration options to override the AMPLIFY CLI config
 * settings.
 * @param {Config} [config] - An AMPLIFY Config instance. If not specified, the config is loaded
 * from disk.
 * @returns {Object}
 */
export function createRequestOptions(opts = {}, config) {
	const { Config } = require('@axway/amplify-config');

	if (opts instanceof Config) {
		config = opts;
		opts = {};
	} else if (!opts && typeof opts !== 'object') {
		throw new TypeError('Expected options to be an object');
	}

	if (!config) {
		config = loadConfig();
	} else if (!(config instanceof Config)) {
		throw new TypeError('Expected config to be an AMPLIFY Config instance');
	}

	const caFile   = config.get('network.caFile');
	const certFile = config.get('network.certFile');
	const keyFile  = config.get('network.keyFile');

	return {
		ca:        caFile && fs.readFileSync(caFile),
		cert:      certFile && fs.readFileSync(certFile),
		key:       keyFile && fs.readFileSync(keyFile),
		proxy:     config.get('network.proxy') || config.get('network.httpsProxy') || config.get('network.httpProxy'),
		strictSSL: config.get('network.strictSSL'),
		...opts
	};
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
		sdk: new AmplifySDK(buildAuthParams(opts, config))
	};
}

/**
 * Loads the AMPLIFY CLI config file using the lazy loaded AMPLIFY Config package.
 *
 * @param {Object} [opts] - Various options. See `@axway/amplify-config` for more details.
 * @returns {Config}
 */
export function loadConfig(opts) {
	return require('@axway/amplify-config').loadConfig(opts);
}
