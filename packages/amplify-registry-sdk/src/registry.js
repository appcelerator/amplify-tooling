
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
	 * Search the registry for packages.
	 * @param {Object} opts - Various options.
	 * @param {String} opts.text - Search text to apply.
	 * @param {String} [opts.repositories] - Comma separated list of repositories to restrict search to.
	 * @param {String} [opts.type] - Type of package to restrict search to.
	 * @returns {Object} - The result of the search
	 */
	async search({ text, repositories, type }) {

		if (!text || typeof text) {
			throw new Error('Expected text to be a valid string');
		}

		let url = `${this.url}/api/packages/v1/-/search?text=${encodeURIComponent(text)}`;

		if (repositories) {
			url = `${url}&repositories=${encodeURIComponent(repositories)}`;
		}
		if (type) {
			url = `${url}&type=${encodeURIComponent(type)}`;
		}

		const params = {
			url
		};

		let { body } = await request(params);
		body = JSON.parse(body);

		return body.result;
	}

	/**
	 * Query the registry for the metadata for a package.
	 * @param {Object} opts - Various options.
	 * @param {String} opts.text - Search text to apply.
	 * @param {String} [opts.version] - Version to restrict the search to, can be a semver range.
	 * @param {String} [opts.repository] - Comma separated list of repositories to restrict search to.
	 * @param {String} [opts.type] - Type of package to restrict search to.
	 * @returns {Object} - Metadata for the package, if a version is supplied then only the metadata for that version is returned
	 * otherwise the entire document for the package is returned.
	 */
	async metadata({ name, version, repository, type }) {

		let url = `${this.url}/api/packages/v1/${encodeURIComponent(name)}`;

		if (version) {
			url = `${url}/${version}`;
		}

		if (repository) {
			url = `${url}?repository=${encodeURIComponent(repository)}`;
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
}
