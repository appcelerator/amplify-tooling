import crypto from 'crypto';

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
 * Copies all params into a new object and converts camelcase property names to underscore case.
 *
 * @param {Object} params - The query string parameters to stringify.
 * @returns {Object}
 */
export function prepareForm(params) {
	const form = new URLSearchParams();
	for (const prop of Object.keys(params).sort()) {
		const name = prop.replace(/[A-Z]/g, (m, i) => `${i ? '_' : ''}${m.toLowerCase()}`);
		form.append(name, params[prop]);
	}
	return form;
}
