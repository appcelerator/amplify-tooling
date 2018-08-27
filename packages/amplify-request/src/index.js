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

export default async function request(params) {
	if (!params || typeof params !== 'object') {
		throw new TypeError('Expected params to be an object');
	}
	const conf =  Object.assign({ method: 'GET', resolveWithFullResponse: true  }, params, getNetworkSettings(params.url, params.userConfig));
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

export function requestStream(params, callback) {
	if (!params || typeof params !== 'object') {
		return Promise.reject(new TypeError('Expected params to be an object'));
	}

	return new Promise((resolve, reject) => {
		const conf =  Object.assign({ method: 'GET' }, params, getNetworkSettings(params.url, params.userConfig));
		const req = _request(conf, callback);
		return resolve(req);
	});
}

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

export function getNetworkSettings(url, userConfig = loadConfig()) {
	const conf = {};

	if (userConfig.get('network.strictSSL') === true) {
		conf.strictSSL = true;
	} else if (userConfig.get('network.strictSSL') === false) {
		conf.strictSSL = false;
	}

	// ca file
	const caFile = userConfig.get('network.caFile') && userConfig.get('network.caFile') && path.resolve(userConfig.get('network.caFile'));
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
