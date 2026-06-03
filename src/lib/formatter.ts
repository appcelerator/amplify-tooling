import { heading } from './logger.js';
import Table from 'cli-table3';

/**
 * Creates a table with default styles and padding.
 *
 * @param {Array.<String>} head - One or more headings.
 * @param {Number} [indent] - The number of spaces to indent the table.
 * @returns {Table}
 */

export function createTable(head?, indent = 0) {
	return new Table({
		chars: {
			bottom: '', 'bottom-left': '', 'bottom-mid': '', 'bottom-right': '',
			left: ' '.repeat(indent), 'left-mid': '',
			mid: '', 'mid-mid': '', middle: '  ',
			right: '', 'right-mid': '',
			top: '', 'top-left': '', 'top-mid': '', 'top-right': ''
		},
		head: Array.isArray(head) ? head.map(heading) : head,
		style: {
			border: [],
			head: [],
			'padding-left': 0,
			'padding-right': 0
		}
	});
}

/**
 * Creates a list of key/value pairs from the provided object.
 *
 * @param {Object|Array} items - The object to convert into key/value pairs.
 * @returns {String} A formatted string of key/value pairs.
 */
export function createKeyList(items) {
	if (!items || typeof items !== 'object') {
		return items;
	}
	let width = 0;
	const rows = [];
	walk(items, []);
	return rows.reduce((str, row) => {
		return str + `${row[0].padEnd(width)} = ${row[1]}\n`;
	}, '').trim();

	function walk(scope, segments) {
		if (Array.isArray(scope) && !scope.length) {
			const path = segments.join('.');
			width = Math.max(width, path.length);
			rows.push([ path, '[]' ]);
			return;
		}
		for (const key of Object.keys(scope).sort()) {
			segments.push(key);
			if (scope[key] && typeof scope[key] === 'object') {
				walk(scope[key], segments);
			} else {
				const path = segments.join('.');
				width = Math.max(width, path.length);
				rows.push([ path, scope[key] ]);
			}
			segments.pop();
		}
	};
}
