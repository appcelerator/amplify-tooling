import fs from 'fs';
import path from 'path';
import _request from 'request';

import { isFile } from 'appcd-fs';
/**
 * A wrapper around request that handles proxy support (and related tasks)
 *
 * @export
 * @param {Object} params - Various options.
 * @param {Object} params.url - URL to make a request to.
 * @returns {Promise<Object>} - The response and body objects
 * @throws {TypeError|Error} - TypeError if params is not an Object, Error if the request errors
 */
export default async function request(params) {
	if (!params || typeof params !== 'object') {
		return Promise.reject(new TypeError('Expected params to be an object'));
	}

	return new Promise((resolve, reject) => {
		// TODO:
		// - Pull in conf stuff when it's in
		// - Optional callback param to allow people to have their own handler? Also return the req object before?
		const {
			AMPLIFY_NETWORK_CA_FILE,
			AMPLIFY_NETWORK_PROXY,
			AMPLIFY_NETWORK_STRICT_SSL
		} = process.env;
		const conf =  Object.assign({ method: 'GET' }, params);

		if (AMPLIFY_NETWORK_CA_FILE && isFile(AMPLIFY_NETWORK_CA_FILE)) {
			conf.ca = fs.readFileSync(AMPLIFY_NETWORK_CA_FILE).toString();
		}

		if (AMPLIFY_NETWORK_PROXY) {
			conf.proxy = AMPLIFY_NETWORK_PROXY;
		}

		if (AMPLIFY_NETWORK_STRICT_SSL !== undefined && AMPLIFY_NETWORK_STRICT_SSL !== 'false') {
			conf.strictSSL = true;
		}

		// ca file
		const caFile = conf.caFile && typeof conf.caFile === 'string' && path.resolve(conf.caFile);
		if (isFile(caFile)) {
			conf.ca = fs.readFileSync(caFile);
			delete conf.caFile;
		}

		// cert file
		const certFile = conf.certFile && typeof conf.certFile === 'string' && path.resolve(conf.certFile);
		if (isFile(certFile)) {
			conf.cert = fs.readFileSync(certFile);
			delete conf.certFile;
		}

		// key file
		const keyFile = conf.keyFile && typeof conf.keyFile === 'string' && path.resolve(conf.keyFile);
		if (isFile(keyFile)) {
			conf.key = fs.readFileSync(keyFile);
			delete conf.keyFile;
		}

		// configure proxy
		const proxyType = conf.url && conf.url.indexOf('https') === 0 ? 'httpsProxy' : 'httpProxy';
		if (conf[proxyType]) {
			conf.proxy = conf[proxyType];
		}
		delete conf.httpProxy;
		delete conf.httpsProxy;

		_request(conf, (err, response, body) => {
			if (err) {
				return reject(err);
			}
			return resolve({ response, body });
		});
	});
}
