import got from 'got';
import snooplogg from 'snooplogg';

import { environments } from '@axway/amplify-cli-utils';

const { log } = snooplogg('amplify-registry-sdk:registry');
const { highlight } = snooplogg.styles;

/**
 * Class for simplifying communication with registry server for the packages APIs.
 */
export default class Registry {
	/**
	 * Create a registry instance.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {String} [opts.env=prod] - The environment name to use for default values.
	 * @param {String} [opts.url] - URL for the registry server.
	 * @access public
	 */
	constructor({ env, url } = {}) {
		this.url = url || environments.resolve(env).registry.url;
	}

	/**
	 * Search the registry for packages and parses reponse as JSON.
	 * @param {Object} opts - Various options.
	 * @param {String} [opts.text] - Search text to apply.
	 * @param {String} [opts.repository] - Repository to restrict search to.
	 * @param {String} [opts.type] - Type of package to restrict search to.
	 * @param {String} [opts.headers] - Custom headers to be passed along with the request.
	 * @returns {Object} - The result of the search
	 */
	async search({ text, repository, type, headers } = {}) {
		let url = `${this.url}/api/packages/v1/-/search`;
		if (text) {
			url = `${url}?text=${encodeURIComponent(text)}`;
		}

		if (repository) {
			const sep = url.includes('?') ? '&' : '?';
			url = `${url}${sep}repository=${encodeURIComponent(repository)}`;
		}

		if (type) {
			const sep = url.includes('?') ? '&' : '?';
			url = `${url}${sep}type=${encodeURIComponent(type)}`;
		}

		const { body } = await got(url, { headers, responseType: 'json' });
		return body.result;
	}

	/**
	 * Query the registry for the metadata for a package and parses reponse as JSON.
	 *
	 * @param {Object} opts - Various options.
	 * @param {String} opts.name - Name of the package.
	 * @param {String} [opts.version] - Version to fetch metadata for.
	 * @param {String} [opts.headers] - Custom headers to be passed along with the request.
	 * @returns {Object} - Metadata for the package, if a version is supplied then only the metadata
	 * for that version is returned otherwise the entire document for the package is returned.
	 */
	async metadata({ name, version, headers } = {}) {
		if (!name || typeof name !== 'string') {
			throw new TypeError('Expected name to be a valid string');
		}
		const url = `${this.url}/api/packages/v1/${encodeURIComponent(name)}${version ? `/${version}` : ''}`;
		log(`Fetching package info: ${highlight(url)}`);
		let body;
		try {
			const data = await got(url, { headers, responseType: 'json' });
			body = data.body;
		} catch (err) {
			if (err.statusCode === 404) {
				const error = new Error(`No version data for ${name}@${version}`);
				error.code = 'ENOVERSIONDATA';
				throw error;
			} else {
				throw err;
			}
		}

		const result = body.result;
		if (result.versions) {
			for (const [ ver, info ] of Object.entries(result.versions)) {
				result.versions[info.version] = info;
				result.time[info.version] = result.time[ver];
				delete result.versions[ver];
				delete result.time[ver];
			}
		}
		return result;
	}
}
