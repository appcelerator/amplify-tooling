/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import fs from 'fs';
import path from 'path';
import _request from 'request';
import requestPromise from 'request-promise-native';

import { isFile } from 'appcd-fs';
import { loadConfig } from '@axway/amplify-cli-utils';

/**
 * Wrapper around request-promise-native that sets any proxy related data for
 * you. By default the method is 'GET' and the request option 'resolveWithFullResponse'
 * is set to true. Any request options can be passed in and will be set
 * @param {Object} options - Various options.
 * @param {String} options.url - URL to make request to.
 * @param {Config} [options.userConfig] - User config object to load 
 */
export default async function request(options) {
	if (!options || typeof options !== 'object') {
		throw new TypeError('Expected options to be an object');
	}
	const conf =  Object.assign({ method: 'GET', resolveWithFullResponse: true  }, options, getNetworkSettings(options.url, options.userConfig));
	let response;
	try {
		response = await requestPromise(conf);
	} catch (err) {
		if (err.name === 'RequestError') {
			throw err.error;
		}
		throw err;
	}
	return response;
}

/**
 * Wrapper around request that that sets any proxy related data for
 * you. Applies the callback if specified and resolves with the request object.
 * @param {Object} params 
 * @param {Function} callback 
 */
export function requestStream(params, callback) {
	if (!params || typeof params !== 'object') {
		return Promise.reject(new TypeError('Expected params to be an object'));
	}

	if (callback && typeof callback !== 'function') {
		return Promise.reject(new TypeError('Expected callback to be a function'));
	}

	return new Promise((resolve, reject) => {
		const conf =  Object.assign({ method: 'GET' }, params, getNetworkSettings(params.url, params.userConfig));
		const req = _request(conf, callback);
		return resolve(req);
	});
}

/**
* Wrapper around request-promise-native that sets any proxy related data for
* you. By default the method is 'GET' and the request option 'resolveWithFullResponse'
* is set to true. Any request options can be passed in and will be set.
* Performs validation on the reponse body and throws an error if the 
* response is invalid JSON
* @param {Object} options - Various options.
* @param {String} options.url - URL to make request to.
* @param {Config} [options.userConfig] - User config object to load 
*/
export async function requestJSON(params) {
	if (!params || typeof params !== 'object') {
		throw new TypeError('Expected params to be an object');
	}
	const conf =  Object.assign({ method: 'GET', resolveWithFullResponse: true }, params, getNetworkSettings(params.url, params.userConfig));
	let response;
	try {
		response = await requestPromise(conf);
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
		const error = new Error(`invalid json response at ${params.url} ${err.message}`);
		error.code = 'INVALID_JSON';
		throw error;
	}
}

/**
 * Load the network settings based of a users config values
 * @param {String} url - The URL to be accessed, used to determine whether to
 * load an http or https proxy.
 * @param {Config} [userConfig] - Users config to load settings from.
 */
export function getNetworkSettings(url, userConfig = loadConfig()) {
	const conf = {};

	if (userConfig.get('network.strictSSL') === true) {
		conf.strictSSL = true;
	} else if (userConfig.get('network.strictSSL') === false) {
		conf.strictSSL = false;
	}

	// ca file
	const caFile = userConfig.get('network.caFile') && typeof userConfig.get('network.caFile') === 'string' && path.resolve(userConfig.get('network.caFile'));
	if (isFile(caFile)) {
		conf.ca = fs.readFileSync(caFile);
	}

	// cert file
	const certFile = userConfig.get('network.certFile') && typeof userConfig.get('network.certFile') === 'string' && path.resolve(userConfig.get('network.certFile'));
	if (isFile(certFile)) {
		conf.cert = fs.readFileSync(certFile);
	}

	// key file
	const keyFile = userConfig.get('network.keyFile') && typeof userConfig.get('network.keyFile') === 'string' && path.resolve(userConfig.get('network.keyFile'));
	if (isFile(keyFile)) {
		conf.key = fs.readFileSync(keyFile);
	}

	// configure proxy
	const proxyType = url && url.indexOf('https') === 0 ? 'httpsProxy' : 'httpProxy';
	if (userConfig.get(`network.${proxyType}`)) {
		conf.proxy = userConfig.get(`network.${proxyType}`);
	}
	return conf;
}

export const libs = {
	request: _request,
	requestPromise
};
