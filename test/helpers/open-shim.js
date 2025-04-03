import got from 'got';
import Module from 'module';

/**
 * This is a shim for the `open` package which would open the web browser, but since we don't want
 * a bunch of browser tabs to be opened and we want to support CI environments, we shim `open` and
 * fake the browser interaction.
 */

const origResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
	return request === 'open' ? __filename : origResolveFilename(request, parent, isMain, options);
};

export default async (url, opts) => {
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
};
