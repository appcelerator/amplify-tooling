/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import fs from 'fs';
import path from 'path';
import _request from 'request';
import requestPromise from 'request-promise-native';

import { isFile } from 'appcd-fs';
import loadConfig from '@axway/amplify-config';

/**
 * Wrapper around request-promise-native that sets any proxy related data for
 * you. By default the method is 'GET' and the request option 'resolveWithFullResponse'
 * is set to true. Any request options can be passed in and will be set.
 * @param {Object} options - Various options.
 * @param {String} options.url - URL to make request to.
 * @param {Config} [options.config] - User config object to query.
 * @param {Boolean} [options.validateJSON] - Validate that the response is valid
 * JSON, and set response.body to that parsed object if it is, throwing if not.
 * @returns {Promise<Object>} Resolves with a Request response object.
 */
export default async function request(options) {
	if (!options || typeof options !== 'object') {
		throw new TypeError('Expected options to be an object');
	}
	const conf = buildRequestParams(options);
	let response;
	try {
		response = await requestPromise(conf);
		if (!options.validateJSON) {
			return response;
		}
	} catch (err) {
		if (err.name === 'RequestError') {
			throw err.error;
		}
		throw err;
	}

	try {
		response.body = JSON.parse(response.body);
		return response;
	} catch (err) {
		const error = new Error(`Invalid JSON response at ${options.url} ${err.message}`);
		error.code = 'INVALID_JSON';
		throw error;
	}
}

/**
 * Wrapper around request that that sets any proxy related data for
 * you. Applies the callback if specified and resolves with the request object.
 * @param {Object} options - Various options.
 * @param {String} options.url - URL to make request to.
 * @param {Config} [options.config] - User config object to query.
 * @param {Function} callback - Function to call when the request is completed.
 * Function is called with the standard err, response and body from Request.
 * @returns {Promise<Object>} Resolves with a Request request object.
 */
export function requestFile(options, callback) {
	if (!options || typeof options !== 'object') {
		throw new TypeError('Expected options to be an object');
	}

	if (callback && typeof callback !== 'function') {
		throw new TypeError('Expected callback to be a function');
	}

	const conf = buildRequestParams(options);
	return _request(conf, callback);
}

/**
 * Build a Request params object based of the supplied options object, and a
 * users network settings from the config. Request options such as strictSSL,
 * proxy, ca, cert, and key will NOT be overriden if they are in the provided
 * options object. All options for Request can be passed into this function.
 * @param {Object} options - Various options.
 * @param {String} options.url = The URL to be accessed.
 * @param {Config} [options.config] - User config object to to query.
 * @returns {Object} An object that can be passed to Request to make a request.
 */
function buildRequestParams(options) {
	let config = options.config;
	delete options.config;
	if (!config) {
		config = loadConfig();
	}

	const conf = Object.assign(
		{ method: 'GET', resolveWithFullResponse: true },
		buildProxyParams(config),
		options
	);

	return conf;
}

export function buildProxyParams(config) {
	if (!config) {
		config = loadConfig();
	}
	const proxyConf = {};
	proxyConf.strictSSL = config.get('network.strictSSL') !== false;
	const props = {
		ca: 'network.caFile',
		cert: 'network.certFile',
		key: 'network.keyFile'
	};
	for (const [ prop, name ] of Object.entries(props)) {
		let file = config.get(name);
		if (file && typeof file === 'string' && (file = path.resolve(file)) && isFile(file)) {
			proxyConf[prop] = fs.readFileSync(file);
		}
	}
	let proxy = config.get('network.httpsProxy');
	if (proxy) {
		proxyConf.proxy = proxy;
	} else {
		proxy = config.get('network.httpProxy');
		if (proxy) {
			proxyConf.proxy = proxy;
		}
	}
	return proxyConf;
}
