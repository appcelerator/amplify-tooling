/**
 * Formats a date in the format "m/d/yyyy".
 * TODO: Replace this with use of Intl date formatter.
 * @param {Date|Number} dt - The date to format.
 * @returns {String}
 */
export function formatDate(dt) {
	if (!(dt instanceof Date)) {
		dt = new Date(dt);
	}
	return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}/${dt.getUTCFullYear()}`;
}
