/**
 * Formats a date in the format "m/d/yyyy".
 *
 * @param {Date|Number} dt - The date to format.
 * @returns {String}
 */
export function formatDate(dt: Date | number): string {
	if (!(dt instanceof Date)) {
		dt = new Date(dt);
	}
	return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}/${dt.getUTCFullYear()}`;
}
