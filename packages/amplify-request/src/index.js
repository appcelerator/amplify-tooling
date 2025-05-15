import sourceMapSupport from 'source-map-support';
/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	sourceMapSupport.install();
}

import fs from 'fs';
import got from 'got';
import HttpProxyAgent from 'http-proxy-agent';
import HttpsProxyAgent from 'https-proxy-agent';
import prettyBytes from 'pretty-bytes';
import snooplogg from 'snooplogg';
import { mergeDeep } from '@axway/amplify-utils';

const { log } = snooplogg('amplify-request');
const { alert, highlight, magenta, ok, note } = snooplogg.styles;

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
export function options(opts = {}) {
	if (!opts || typeof opts !== 'object') {
		throw new TypeError('Expected options to be an object');
	}

	opts = { ...opts };

	const { defaults } = opts;
	const {
		ca        = defaults?.ca,
		caFile    = defaults?.caFile,
		cert      = defaults?.cert,
		certFile  = defaults?.certFile,
		key       = defaults?.key,
		keyFile   = defaults?.keyFile,
		proxy     = defaults?.proxy,
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

	const load = it => Buffer.isBuffer(it) ? it : typeof it === 'string' ? fs.readFileSync(it) : undefined;

	opts.hooks = mergeDeep(opts.hooks, {
		afterResponse: [
			response => {
				const { headers, request, statusCode, url } = response;
				log([
					request.options.method,
					highlight(url),
					proxy && note(`[proxy ${proxy}]`),
					Object.prototype.hasOwnProperty.call(headers, 'content-length') && magenta(`(${prettyBytes(~~headers['content-length'])})`),
					statusCode < 400 ? ok(statusCode) : alert(statusCode)
				].filter(Boolean).join(' '));
				return response; // note: this must return response
			}
		]
	});

	opts.https = mergeDeep(opts.https, {
		certificate:          load(opts.https?.certificate || cert || certFile),
		certificateAuthority: load(opts.https?.certificateAuthority || ca || caFile),
		key:                  load(opts.https?.key || key || keyFile),
		rejectUnauthorized:   opts.https?.rejectUnauthorized !== undefined ? opts.https.rejectUnauthorized : !!strictSSL !== false
	});

	if (proxy) {
		const { hostname: host, pathname: path, port, protocol, username, password } = new URL(proxy);
		const agentOpts = {
			ca:                 opts.https.certificateAuthority,
			cert:               opts.https.certificate,
			host,
			key:                opts.https.key,
			path,
			port,
			auth: username && password ? `${username}:${password}` : null,
			protocol,
			rejectUnauthorized: opts.https.rejectUnauthorized
		};
		opts.agent = {
			...opts.agent,
			http: opts.agent?.http || new HttpProxyAgent(agentOpts),
			https: opts.agent?.https || new HttpsProxyAgent(agentOpts)
		};
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
