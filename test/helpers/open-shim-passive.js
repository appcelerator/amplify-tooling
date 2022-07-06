/**
 * This is a shim for the `open` package which would open the web browser, but since we don't want
 * a bunch of browser tabs to be opened and we want to support CI environments, we shim `open` and
 * fake the browser interaction.
 */

import './arch-shim.js';

export function resolve(specifier, context, defaultResolve) {
	if (specifier === 'open') {
		return {
			url: import.meta.url
		};
	}
	return defaultResolve(specifier, context, defaultResolve);
}

export default async function shimmedPassiveOpen(url, opts) {
	// do nothing
}
