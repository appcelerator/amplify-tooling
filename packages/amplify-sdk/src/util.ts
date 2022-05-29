import crypto from 'crypto';

/**
 * Appends query string parameters to a URL.
 *
 * @param {String} url - The URL.
 * @param {Object} params - A map of query string parameters.
 * @returns {String}
 */
export function createURL(url: string, params: { [key: string]: string | number | undefined }) {
	return `${url}${url.includes('?') ? '&' : '?'}${prepareForm(params).toString()}`;
}

/**
 * Returns a hex encoded md5 hash of a string or object.
 *
 * @param {String|Object} it - The object to serialize and hash.
 * @returns {String}
 */
export function md5(it: string | any) {
	return crypto.createHash('md5').update(typeof it === 'string' ? it : JSON.stringify(it)).digest('hex');
}

/**
 * Copies all params into a new object and converts camelcase property names to underscore case.
 *
 * @param {Object} params - The query string parameters to stringify.
 * @returns {Object}
 */
export function prepareForm(params: { [key: string]: string | number | undefined }) {
	const form = new URLSearchParams();
	for (const prop of (Object.keys(params).sort() as string[])) {
		if (params[prop] !== undefined) {
			const name = prop.replace(/[A-Z]/g, (m, i) => `${i ? '_' : ''}${m.toLowerCase()}`);
			form.append(name, String(params[prop]));
		}
	}
	return form;
}
