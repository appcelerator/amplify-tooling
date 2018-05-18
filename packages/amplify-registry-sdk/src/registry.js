import got from 'got';

export default class Registry {

	constructor(opts) {

		if (!opts) {
			opts = {};
		}

		this.url = opts.url || 'http://localhost:8082';
	}

	async search({ text, repositories, type }) {
		let url = `${this.url}/api/packages/v1/-/search?text=${encodeURIComponent(text)}`;
		if (repositories) {
			url = `${url}&repositories=${encodeURIComponent(repositories)}`;
		}
		if (type) {
			url = `${url}&type=${encodeURIComponent(type)}`;
		}
		const { body } = await got(url);
		return JSON.parse(body.result);
	}

	async metadata({ name, version, repository, type }) {
		let url = `http://localhost:8082/api/packages/v1/${encodeURIComponent(name)}`;
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
		let { body } = await got(url);
		body = JSON.parse(body);
		return body.result;
	}

	async install({ name, version, repository, type }) {
		const body = await this.metadata({ name, version, repository, type });
		if (body.length) {
			return undefined;
		}
		if (!version) {
			const version = body.latest_version.replace(/\./g, '_');
			return body.versions[version];
		}
		return body;
	}
}
