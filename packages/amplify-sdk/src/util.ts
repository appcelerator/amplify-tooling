import crypto from 'crypto';
import E from './errors.js';

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
export function prepareForm(params: { [key: string]: string | number | undefined }): URLSearchParams {
	const form = new URLSearchParams();
	for (const prop of (Object.keys(params).sort() as string[])) {
		if (params[prop] !== undefined) {
			const name = prop.replace(/[A-Z]/g, (m, i) => `${i ? '_' : ''}${m.toLowerCase()}`);
			form.append(name, String(params[prop]));
		}
	}
	return form;
}

export interface DateRange {
	from: Date,
	to: Date
}

/**
 * Takes two date strings in the format `YYYY-MM-DD` and returns them as date objects.
 *
 * @param {String} [from] - The range start date.
 * @param {String} [to] - The range end date.
 * @returns {Object}
 */
export function resolveDateRange(from?: string, to?: string): DateRange {
	const r: DateRange = {} as DateRange;
	const tsRE = /^\d{4}-\d{2}-\d{2}$/;
	let ts;

	if (from) {
		if (!tsRE.test(from) || isNaN(ts = Date.parse(`${from} 00:00:00 GMT`))) {
			throw E.INVALID_ARGUMENT('Expected "from" date to be in the format YYYY-MM-DD');
		}
		r.from = new Date(ts);
	} else {
		r.from = new Date(Date.now() - (14 * 24 * 60 * 60 * 1000)); // 14 days
	}

	if (to) {
		if (!tsRE.test(to) || isNaN(ts = Date.parse(`${to} 23:59:59 GMT`))) {
			throw E.INVALID_ARGUMENT('Expected "to" date to be in the format YYYY-MM-DD');
		}
		r.to = new Date(ts);
	} else {
		r.to = new Date();
	}

	return r;
}

/**
 * Determines the from and to date range for the specified month or month/year.
 *
 * @param {String|Number|Boolean} month - The month, year and month, or `""`/`true` for current
 * month, to create a date range from.
 * @return {Object}
 */
export function resolveMonthRange(month: string | number | boolean): { from: string, to: string } {
	const now = new Date();
	let year = now.getUTCFullYear();
	let monthIdx = now.getUTCMonth();
	let monthInt = monthIdx + 1;

	if (typeof month === 'number') {
		monthIdx = month - 1;
		monthInt = month;
	} else if (month !== true && month !== '') {
		if (typeof month !== 'string') {
			throw E.INVALID_ARGUMENT('Expected month to be in the format YYYY-MM or MM');
		}

		const m = month.match(/^(?:(\d{4})-)?(\d\d?)$/);
		if (!m || !m[2]) {
			throw E.INVALID_ARGUMENT('Expected month to be in the format YYYY-MM or MM');
		}

		if (m[1]) {
			year = parseInt(m[1]);
		}
		monthInt = parseInt(m[2]);
		monthIdx = monthInt - 1;
	}

	const days = [ 31, year % 4 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];
	if (!days[monthIdx]) {
		throw E.INVALID_MONTH(`Invalid month "${monthInt}"`);
	}

	const monthStr = String(monthIdx + 1).padStart(2, '0');
	return {
		from: `${year}-${monthStr}-01`,
		to: `${year}-${monthStr}-${days[monthIdx]}`
	};
}
