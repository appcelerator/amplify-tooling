
import { request } from '@axway/amplify-cli-utils';
/**
 * Class for simplifying communication with registry server for the packages APIs
 */
export default class Registry {

	/**
	 * Create a registry instance
	 * @param {Object} [opts] - Various options
	 * @param {String} [opts.url=http://localhost:8082] - URL for the registry server
	 */
	constructor({ url } = {}) {
		this.url = url || 'http://localhost:8082';
	}

	/**
	 * Search the registry for packages and parses reponse as JSON.
	 * @param {Object} opts - Various options.
	 * @param {String} [opts.text] - Search text to apply.
	 * @param {String} [opts.repository] - Repository to restrict search to.
	 * @param {String} [opts.type] - Type of package to restrict search to.
	 * @returns {Object} - The result of the search
	 */
	async search({ text, repository, type } = {}) {

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

		const params = {
			url
		};

		let { body } = await request(params);
		body = JSON.parse(body);

		return body.result;
	}

	/**
	 * Query the registry for the metadata for a package and parses reponse as JSON.
	 * @param {Object} opts - Various options.
	 * @param {String} opts.name - Name of the package.
	 * @param {String} [opts.version] - Version to fetch metadata for.
	 * @returns {Object} - Metadata for the package, if a version is supplied then only the metadata for that version is returned
	 * otherwise the entire document for the package is returned.
	 */
	async metadata({ name, version } = {}) {

		if (!name || typeof name !== 'string') {
			throw new TypeError('Expected name to be a valid string');
		}

		let url = `${this.url}/api/packages/v1/${encodeURIComponent(name)}`;

		if (version) {
			url = `${url}/${version}`;
		}

		const params = {
			url
		};

		let { body } = await request(params);
		body = JSON.parse(body);

		return body.result;
	}
}
