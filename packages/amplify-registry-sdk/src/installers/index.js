import Registry from '../registry';
import extractPackage from './extracters';
import fetchPackage from './fetchers';

export async function fetchAndInstall({ name, repository, type, fetchSpec, url }) {

	const registry = new Registry({ url });
	const pkgInfo = await registry.metadata({ name, repository, type, version: fetchSpec });
	if (!pkgInfo) {
		const err = new Error('No data returned');
		err.code = 'NO_DATA';
		throw err;
	}
	const actions = await getActions(pkgInfo.type);

	if (actions.pre) {
		await actions.pre();
	}
	const zipLocation = await fetchPackage(pkgInfo);
	const extractLocation = await extractPackage({ zipLocation, type: pkgInfo.type });

	if (actions.post) {
		await actions.post({ pkgInfo, location: extractLocation });
	}

	return pkgInfo;
}

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
