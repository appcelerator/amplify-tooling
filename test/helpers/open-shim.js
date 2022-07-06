/**
 * This is a shim for the `open` package which would open the web browser, but since we don't want
 * a bunch of browser tabs to be opened and we want to support CI environments, we shim `open` and
 * fake the browser interaction.
 */

import got from 'got';

export function resolve(specifier, context, defaultResolve) {
	if (specifier === 'open') {
		return {
			url: import.meta.url
		};
	}
	return defaultResolve(specifier, context, defaultResolve);
}

export default async function shimmedOpen(url, opts) {
	const response = await got(url);
	const parsedUrl = new URL(response.url);
	let { hash, origin } = parsedUrl;
	if (hash) {
		hash = hash.replace(/^#/, '');
		if (!hash.startsWith('http')) {
			hash = origin + hash;
		}
		const parsedHash = new URL(hash);
		const redirect = parsedHash.searchParams.get('redirect');
		if (redirect) {
			await got(redirect);
		}
	}
}
