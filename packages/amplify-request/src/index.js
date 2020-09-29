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
 * @param {Buffer|String} [opts.ca] - A buffer containing the certificate authority bundle or a
 * path to a PEM-formatted ca bundle.
 * @param {Buffer|String} [opts.cert] - A buffer containing a client certificate or a path to a
 * cert file. This value is used for HTTP authentication.
 * @param {Buffer|String} [opts.key] - A buffer containing a client private key or a path to a
 * private key file. This value is used for HTTP authentication.
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

	const load = it => Buffer.isBuffer(it) ? it : typeof it === 'string' ? fs.readFileSync(it) : it;

	opts.https = {
		...opts.https,
		certificate:          load(opts.https?.certificate || cert),
		certificateAuthority: load(opts.https?.certificateAuthority || ca),
		key:                  load(opts.https?.key || key),
		rejectUnauthorized:   opts.https?.rejectUnauthorized !== undefined ? opts.https.rejectUnauthorized : !!strictSSL !== false
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
