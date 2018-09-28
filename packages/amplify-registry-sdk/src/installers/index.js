import { EventEmitter } from 'events';
import Registry from '../registry';
import extractPackage from './extracters';
import fetchPackage from './fetchers';

export class PackageInstaller extends EventEmitter {
	constructor({ env, fetchSpec, headers, name, repository, type, url }) {
		super();
		this.registry = new Registry({ env, url });
		Object.assign(this, { fetchSpec, headers, name, repository, type });
	}

	async start () {
		const pkgInfo = await this.registry.metadata({ 
			headers: this.headers,
			name: this.name,
			repository: this.repository,
			type: this.type,
			version: this.fetchSpec
		});
		if (!pkgInfo) {
			const err = new Error('No data returned');
			err.code = 'NO_DATA';
			throw err;
		}
		const actions = await getActions(pkgInfo.type);

		if (actions.pre) {
			this.emit('preActions');
			await actions.pre();
		}
		this.emit('download');
		const zipLocation = await fetchPackage(pkgInfo);

		this.emit('extract');
		const extractLocation = await extractPackage({ zipLocation, type: pkgInfo.type });

		if (actions.post) {
			this.emit('postActions');
			await actions.post({ pkgInfo, location: extractLocation, emit: this });
		}
		return pkgInfo;
	}
}

// export async function fetchAndInstall({ name, repository, type, fetchSpec, env, url }) {
// 	const emitter = new EventEmitter();
// 	return Promise.resolve(emitter);
// 	emitter.emit('stuff');
// 	const registry = new Registry({ env, url });
// 	const pkgInfo = await registry.metadata({ name, repository, type, version: fetchSpec });
// 	if (!pkgInfo) {
// 		const err = new Error('No data returned');
// 		err.code = 'NO_DATA';
// 		throw err;
// 	}
// 	const actions = await getActions(pkgInfo.type);

// 	if (actions.pre) {
// 		await actions.pre();
// 	}
// 	const zipLocation = await fetchPackage(pkgInfo);
// 	const extractLocation = await extractPackage({ zipLocation, type: pkgInfo.type });

// 	if (actions.post) {
// 		await actions.post({ pkgInfo, location: extractLocation });
// 	}
// }

async function getActions(packageType) {
	switch (packageType) {
		case 'apib-data-connector':
			return await import('./actions/apib-data-connector');
		case 'amplify-cli-plugin':
			return await import('./actions/amplify-cli-plugin');
		default:
			return {};
	}
}
