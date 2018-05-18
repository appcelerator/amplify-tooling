import Registry from '../registry';

export async function fetchAndInstall({ name, repository, type, fetchSpec }) {
	const registry = new Registry();
	const pkgInfo = await registry.install({ name, repository, type, version: fetchSpec });
	if (!pkgInfo) {
		const err = new Error('No data returned');
		err.code = 'NO_DATA';
		throw err;
	}
	const fetcher = await getFetcher(pkgInfo.dist.repository);
	const installLocation = await fetcher.fetchPackage({ pkgInfo: pkgInfo });
	const extracter = await getExtracter(pkgInfo.type);
	const extractLocation = await extracter.extractPackage(installLocation);
	const postSteps = await getPostSteps(pkgInfo.type);
	if (postSteps) {
		await postSteps.run({ pkgInfo, location: extractLocation });
	}
	return pkgInfo;
}

async function getPostSteps(packageType) {
	switch (packageType) {
		case 'apib-data-connector':
			return await import('./actions/post/apib-data-connector');
		case 'amplify-cli-plugin':
			return await import('./actions/post/amplify-cli-plugin');
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
