import E from './errors';
import fetch from 'node-fetch';
import querystring from 'querystring';
import snooplogg from 'snooplogg';

const { log } = snooplogg('amplify-auth:util');

/**
 * Discovers available endpoints based on the remote server's OpenID configuration.
 *
 * @param {String} [url] - An optional URL to discover the available endpoints.
 * @returns {Promise<Object>}
 * @access public
 */
export async function getServerInfo(url) {
	if (!url || typeof url !== 'string') {
		throw E.INVALID_ARGUMENT('Expected URL to be a non-empty string');
	}

	log(`Fetching server info: ${url}...`);
	const res = await fetch(url);
	return res.json();
}

/**
 * Copies all params into a new object and converts camelcase property names to underscore case,
 * then returns the stringified query string.
 *
 * @param {Object} params - The query string parameters to stringify.
 * @returns {String}
 */
export function stringifyQueryString(params) {
	const queryParams = {};
	for (const prop of Object.keys(params).sort()) {
		const name = prop.replace(/[A-Z]/g, (m, i) => `${i ? '_' : ''}${m.toLowerCase()}`);
		queryParams[name] = params[prop];
	}
	return querystring.stringify(queryParams);
}
