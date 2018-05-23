import Registry from '../registry';
import extractPackage from './extract';

export async function fetchAndInstall({ name, repository, type, fetchSpec }) {
	const registry = new Registry();
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
	const fetcher = await getFetcher(pkgInfo.dist.repository);
	const zipLocation = await fetcher.fetchPackage({ pkgInfo: pkgInfo });
	const extractLocation = await extractPackage({ zipLocation, type: pkgInfo.type });
	console.log(extractLocation);
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
			return undefined;
	}
}

async function getExtracter(packageType) {
	switch (packageType) {
		case 'apib-data-connector':
			return await import('./extracters/apib-data-connector');
		case 'amplify-cli-plugin':
			return await import('./extracters/amplify-cli-plugin');
	}
}

async function getFetcher(repository) {
	switch (repository) {
		case 'marketplace':
			return await import('./fetchers/marketplace');
		case 'npm':
			return await import('./fetchers/npm');
	}
}
