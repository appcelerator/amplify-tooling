import _ from 'lodash';
import fs from 'fs';
import chalk from 'chalk';
import got from 'got';
import httpProxyAgentPkg from 'http-proxy-agent';
import httpsProxyAgentPkg from 'https-proxy-agent';
import loadConfig, { Config } from './config.js';
import path from 'path';
import prettyBytes from 'pretty-bytes';
import logger, { alert, highlight, ok, note } from './logger.js';
import { fileURLToPath } from 'url';
import { readJsonSync } from './fs.js';

const { HttpProxyAgent } = httpProxyAgentPkg;
const { HttpsProxyAgent } = httpsProxyAgentPkg;

const { log } = logger('axway-cli:request');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { version } = readJsonSync(path.resolve(__dirname, '../../package.json'));
/**
 * The user agent to use in outgoing requests.
 * IMPORTANT! Platform explicitly checks this user agent, so do NOT change the name or case.
 */
const userAgent = `Axway CLI/${version} (${process.platform}; ${process.arch}; node:${process.versions.node})`;

export { got };

/**
 * Creates an options object for use with `got`.
 *
 * @param {Object} [opts] - `got` options.
 * @param {Buffer|String} [opts.ca] - A buffer containing the certificate authority bundle or a
 * path to a PEM-formatted ca bundle.
 * @param {Buffer|String} [opts.cert] - A buffer containing a client certificate or a path to a
 * cert file. This value is used for HTTP authentication.
 * @param {Object} [opts.defaults] - An object with the default options. This is helpful when you
 * want to merge settings from some config file with various got() options such as `headers`.
 * @param {Buffer|String} [opts.key] - A buffer containing a client private key or a path to a
 * private key file. This value is used for HTTP authentication.
 * @param {String} [opts.proxy] - A proxy server URL. Can be `http` or `https`.
 * @param {Boolean} [opts.strictSSL=true] - When falsey, disables TLS/SSL certificate validation
 * for both `https` destinations and `https` proxy servers.
 * @returns {Promise} Resolves `got` options object.
 */
export function options(opts: any = {}) {
	if (!opts || typeof opts !== 'object') {
		throw new TypeError('Expected options to be an object');
	}

	opts = { ...opts };

	const { defaults } = opts;
	const {
		ca = defaults?.ca,
		caFile = defaults?.caFile,
		cert = defaults?.cert,
		certFile = defaults?.certFile,
		key = defaults?.key,
		keyFile = defaults?.keyFile,
		proxy = defaults?.proxy,
		strictSSL = defaults?.strictSSL
	} = opts;

	delete opts.ca;
	delete opts.caFile;
	delete opts.cert;
	delete opts.certFile;
	delete opts.defaults;
	delete opts.key;
	delete opts.keyFile;
	delete opts.proxy;
	delete opts.strictSSL;

	// Default all requests to use the custom CLI user agent
	opts.headers = {
		'User-Agent': userAgent
	};

	const load = it => (Buffer.isBuffer(it) ? it : typeof it === 'string' ? fs.readFileSync(it) : undefined);

	opts.hooks = _.merge(opts.hooks, {
		afterResponse: [
			response => {
				const { headers, request, statusCode, url } = response;
				log([
					request.options.method,
					highlight(url),
					proxy && note(`[proxy ${proxy}]`),
					Object.prototype.hasOwnProperty.call(headers, 'content-length') && chalk.magenta(`(${prettyBytes(Number(headers['content-length']))})`),
					statusCode < 400 ? ok(statusCode) : alert(statusCode)
				].filter(Boolean).join(' '));
				return response; // note: this must return response
			}
		]
	});

	opts.https = {
		...opts.https || {},
		certificate: load(opts.https?.certificate || cert || certFile),
		certificateAuthority: load(opts.https?.certificateAuthority || ca || caFile),
		key: load(opts.https?.key || key || keyFile),
		rejectUnauthorized: opts.https?.rejectUnauthorized !== undefined ? opts.https.rejectUnauthorized : !!strictSSL !== false
	};

	if (proxy) {
		const { hostname: host, pathname: path, port, protocol, username, password } = new URL(proxy);
		const agentOpts = {
			ca: opts.https.certificateAuthority,
			cert: opts.https.certificate,
			host,
			key: opts.https.key,
			path,
			port,
			auth: username && password ? `${username}:${password}` : null,
			protocol,
			rejectUnauthorized: opts.https.rejectUnauthorized
		};
		opts.agent ||= {};
		opts.agent.http ||= new HttpProxyAgent(agentOpts);
		opts.agent.https ||= new HttpsProxyAgent(agentOpts);
	}

	return opts;
}

/**
 * Creates `got` instance with the applied configuration.
 *
 * @param {Object} [opts] - `got` options.
 * @param {Buffer|String} [opts.ca] - A buffer containing the certificate authority bundle or a
 * path to a PEM-formatted ca bundle.
 * @param {Buffer|String} [opts.cert] - A buffer containing a client certificate or a path to a
 * cert file. This value is used for HTTP authentication.
 * @param {Object} [opts.defaults] - An object with the request defaults.
 * @param {Buffer|String} [opts.key] - A buffer containing a client private key or a path to a
 * private key file. This value is used for HTTP authentication.
 * @param {String} [opts.proxy] - A proxy server URL. Can be `http` or `https`.
 * @param {Boolean} [opts.strictSSL=true] - When falsey, disables TLS/SSL certificate validation
 * for both `https` destinations and `https` proxy servers.
 * @returns {Function} A `got` instance.
 */
export function init(opts = {}) {
	return got.extend(options(opts));
}

export default init;

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

	load('network.caFile', 'ca');
	load('network.certFile', 'cert');
	load('network.keyFile', 'key');
	load('network.proxy', 'proxy');
	load('network.httpsProxy', 'proxy');
	load('network.httpProxy', 'proxy');
	load('network.strictSSL', 'strictSSL');

	return opts;
}
