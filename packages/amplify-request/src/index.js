/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import fs from 'fs';
import got from 'got';
import HttpProxyAgent from 'http-proxy-agent';
import HttpsProxyAgent from 'https-proxy-agent';

export { got };

/**
 * Creates `got` instance with the applied configuration.
 *
 * @param {Object} [opts] - `got` options.
 * @param {Buffer|String} [opts.ca] - A buffer containing the certificate authority bundle bytes or
 * a path to a PEM-formatted ca bundle.
 * @param {String} [opts.proxy] - A proxy server URL. Can be `http` or `https`.
 * @param {Boolean} [opts.strictSSL=true] - When falsey, disables TLS/SSL certificate validation
 * for both `https` destinations and `https` proxy servers.
 * @returns {Function} A `got` instance.
 */
export function init(opts = {}) {
	if (!opts || typeof opts !== 'object') {
		throw new TypeError('Expected options to be an object');
	}

	const { ca, cert, key, proxy, strictSSL } = opts;

	delete opts.ca;
	delete opts.cert;
	delete opts.key;
	delete opts.proxy;
	delete opts.strictSSL;

	const load = it => Buffer.isBuffer(it) ? it : typeof it === 'string' ? fs.readFileSync(it) : null;

	opts.https = {
		...opts.https,
		certificate:          load(cert) || opts.https?.certificate,
		certificateAuthority: load(ca)   || opts.https?.certificateAuthority,
		key:                  load(key)  || opts.https?.key,
		rejectUnauthorized:   strictSSL !== undefined ? !!strictSSL !== false : opts.https?.rejectUnauthorized
	};

	if (proxy) {
		const { hostname: host, pathname: path, port, protocol } = new URL(proxy);
		const agentOpts = {
			ca:                 opts.https?.certificateAuthority,
			cert:               opts.https?.certificate,
			host,
			key:                opts.https?.key,
			path,
			port,
			protocol,
			rejectUnauthorized: opts.https?.rejectUnauthorized
		};
		// console.log(agentOpts);
		opts.agent = {
			...opts.agent,
			http: opts.agent?.http || new HttpProxyAgent(agentOpts),
			https: opts.agent?.https || new HttpsProxyAgent(agentOpts)
		};
	}

	// console.log(opts);
	return got.extend(opts);
}

export default init;
