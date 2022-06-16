import fs from 'fs';
import loadConfig, { Config } from '@axway/amplify-config';
import { GotReturn } from 'got';
import { RequestOptions } from '@axway/amplify-request';
import * as request from '@axway/amplify-request';

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
export async function createNPMRequestArgs(opts: RequestOptions = {}, config: Config) {
	const { ca, cert, key, proxy, strictSSL } = await createRequestOptions(opts, config);
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
export async function createRequestClient(opts: RequestOptions = {}, config: Config): Promise<GotReturn> {
	opts = await createRequestOptions(opts, config);
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
export async function createRequestOptions(opts: RequestOptions | Config = {}, config?: Config): Promise<RequestOptions> {
	let reqOpts: RequestOptions = {};
	if (opts instanceof Config) {
		config = opts;
	} else if (!opts && typeof opts !== 'object') {
		throw new TypeError('Expected options to be an object');
	} else {
		reqOpts = { ...opts };
	}

	if (config && !(config instanceof Config)) {
		throw new TypeError('Expected config to be an Amplify Config instance');
	}

	const load = async (src: string, dest: string) => {
		if (reqOpts[dest as keyof RequestOptions] !== undefined) {
			return;
		}
		if (!config) {
			config = await loadConfig();
		}
		const value = config.get(src);
		if (value === undefined) {
			return;
		}
		if (dest === 'proxy') {
			reqOpts.proxy = value;
		} else if (dest === 'strictSSL') {
			reqOpts.strictSSL = !!value !== false;
		} else {
			reqOpts[dest as keyof RequestOptions] = fs.readFileSync(value, 'utf-8') as any;
		}
	};

	await load('network.caFile',     'ca');
	await load('network.certFile',   'cert');
	await load('network.keyFile',    'key');
	await load('network.proxy',      'proxy');
	await load('network.httpsProxy', 'proxy');
	await load('network.httpProxy',  'proxy');
	await load('network.strictSSL',  'strictSSL');

	return reqOpts;
}
