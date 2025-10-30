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
