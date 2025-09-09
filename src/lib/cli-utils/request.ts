import fs from 'fs';
import loadConfig, { Config } from '../config.js';
import * as request from '../request.js';

/**
 * Builds an array of Axway CLI network settings for use as command line arguments when spawning
 * `npm`.
 *
 * @param {Object} [opts] - Request configuration options to override the Axway CLI config
 * settings.
 * @param {Config} [config] - An Amplify Config instance. If not specified, the config is loaded
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
 * settings from the Axway CLI config file.
 *
 * @param {Object} [opts] - `got` option to override the Axway CLI config settings.
 * @param {Config} [config] - An Amplify Config instance. If not specified, the config is loaded
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
 * Loads the Axway CLI config file and construct the options for the various Node.js HTTP clients
 * including `pacote`, `npm-registry-fetch`, `make-fetch-happen`, and `request`.
 *
 * @param {Object} [opts] - Request configuration options to override the Axway CLI config
 * settings.
 * @param {Config} [config] - An Amplify Config instance. If not specified, the config is loaded
 * from disk.
 * @returns {Object}
 */
export function createRequestOptions(opts = {}, config?): any {
	if (opts instanceof Config) {
		config = opts;
		opts = {};
	} else if (!opts && typeof opts !== 'object') {
		throw new TypeError('Expected options to be an object');
	} else {
		opts = { ...opts };
	}

	if (config && !(config instanceof Config)) {
		throw new TypeError('Expected config to be an Amplify Config instance');
	}

	const load = async (src, dest) => {
		if (opts[dest] !== undefined) {
			return;
		}
		if (!config) {
			config = await loadConfig();
		}
		const value = await config.get(src);
		if (value === undefined) {
			return;
		}
		if (dest === 'proxy') {
			opts[dest] = value;
		} else if (dest === 'strictSSL') {
			opts[dest] = !!value !== false;
		} else {
			opts[dest] = fs.readFileSync(value);
		}
	};

	load('network.caFile',     'ca');
	load('network.certFile',   'cert');
	load('network.keyFile',    'key');
	load('network.proxy',      'proxy');
	load('network.httpsProxy', 'proxy');
	load('network.httpProxy',  'proxy');
	load('network.strictSSL',  'strictSSL');

	return opts;
}
