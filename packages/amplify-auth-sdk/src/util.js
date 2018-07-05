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
 */
export async function getServerInfo(url) {
	if (!url || typeof url !== 'string') {
		throw E.INVALID_ARGUMENT('Expected URL to be a non-empty string');
	}

	log(`Fetching server info: ${url}...`);
	const res = await fetch(url);

	if (!res.ok) {
		throw new Error(`Failed to get server info (status ${res.status})`);
	}

	return await res.json();
}

/**
 * Generates an HTML page with a panel containing a title and a message.
 *
 * @param {String} title - The title to display.
 * @param {String} message - The message to inject into the page.
 * @returns {String}
 */
export function renderHTML(title, message) {
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

	h1 {
		font-size: 24px;
		font-weight: bold;
	}
	</style>
</head>
<body>
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
	const queryParams = {};
	for (const prop of Object.keys(params).sort()) {
		const name = prop.replace(/[A-Z]/g, (m, i) => `${i ? '_' : ''}${m.toLowerCase()}`);
		queryParams[name] = params[prop];
	}
	return querystring.stringify(queryParams);
}
