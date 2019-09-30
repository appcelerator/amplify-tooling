import crypto from 'crypto';
import E from './errors';
import request from '@axway/amplify-request';
import snooplogg from 'snooplogg';

import { STATUS_CODES } from 'http';
import { URLSearchParams } from 'url';

const { error, log } = snooplogg('amplify-auth:util');

/**
 * Discovers available endpoints based on the remote server's OpenID configuration.
 *
 * @param {String} [url] - An optional URL to discover the available endpoints.
 * @returns {Promise<Object>}
 */
export async function getServerInfo(url) {
	if (!url || typeof url !== 'string') {
		throw E.INVALID_ARGUMENT('Expected URL to be a non-empty string');
	}

	log(`Fetching server info: ${url}...`);
	try {
		const { body } = await request({ url, validateJSON: true });
		return body;
	} catch (err) {
		if (err.code === 'INVALID_JSON') {
			throw err;
		}
		throw new Error(`Failed to get server info (status ${err.statusCode})`);
	}

}

/**
 * Constructs an error from a failed fetch request, logs it, and returns it.
 *
 * @param {Object} params - Various parameters.
 * @param {String} params.label - The error label.
 * @param {Response} params.response - A fetch response object.
 * @param {Boolean} [params.optional] - When `true`, a failed request is logged, but not as an error.
 * @returns {Promise<Error>}
 */
export function handleRequestError({ label, response, optional }) {
	const meta = {};
	let err = response.error;
	let { message, statusCode } = response;
	let status = meta.status = statusCode ? STATUS_CODES[String(statusCode)] : 'Unknown error';
	let details;

	meta.statusCode = statusCode;
	if (response instanceof Error) {
		meta.error = response;
	}

	try {
		const obj = JSON.parse(err || message);
		if (obj.error) {
			details = `${obj.error}${obj.error_description ? `: ${obj.error_description}` : ''}`;
		} else if (obj.description) {
			details = obj.description;
		}
	} catch (e) {
		// squelch
	}

	const msg = `${label}: ${statusCode ? `${statusCode} ` : ''}${details || err || message || status}`;
	if (optional) {
		log(msg);
	} else {
		error(msg);
	}
	return E.REQUEST_FAILED(msg, meta);
}

/**
 * Returns a hex encoded md5 hash of a string or object.
 *
 * @param {String|Object} it - The object to serialize and hash.
 * @returns {String}
 */
export function md5(it) {
	return crypto.createHash('md5').update(typeof it === 'string' ? it : JSON.stringify(it)).digest('hex');
}

/**
 * Generates an HTML page with a panel containing a title and a message.
 *
 * @param {String} title - The title to display.
 * @param {String} message - The message to inject into the page.
 * @returns {String}
 */
export function renderHTML({ cls, message, title }) {
	return `<!doctype html>
<html>
<head>
	<title>${title}</title>
	<style>
	body {
		background-color: #fff;
		color: #333;
		font-family: "Open Sans","Helvetica Neue","Arial",sans-serif;
		font-size: 15px;
	}

	body > div {
		background-color: #f7f7f7;
		border: 1px solid #cbcbcb;
		border-radius: 4px;
		margin: 30px auto;
		padding: 20px 30px;
		width: 360px;
	}

	.success > div {
		background-color: #daffdb;
		border: 1px solid #00cb06;
		color: #00cb06;
	}

	.error > div {
		background-color: #ffdada;
		border: 1px solid #cb0000;
		color: #cb0000;
	}

	h1 {
		font-size: 24px;
		font-weight: bold;
	}
	</style>
</head>
<body class="${cls || ''}">
	<div>
		<h1>${title}</h1>
		<p>${String(message).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
	</div>
</body>
</html>`;
}

/**
 * Copies all params into a new object and converts camelcase property names to underscore case,
 * then returns the stringified query string.
 *
 * @param {Object} params - The query string parameters to stringify.
 * @returns {String}
 */
export function stringifyQueryString(params) {
	const queryParams = new URLSearchParams();
	for (const prop of Object.keys(params).sort()) {
		const name = prop.replace(/[A-Z]/g, (m, i) => `${i ? '_' : ''}${m.toLowerCase()}`);
		queryParams.append(name, params[prop]);
	}
	return queryParams.toString();
}
