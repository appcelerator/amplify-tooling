import { removeSync } from 'fs-extra';
import { addPackageToConfig, npmInstall, removePackageFromConfig } from '../../common';

export async function post({ pkgInfo, location }) {
	try {
		await npmInstall({ directory: location });
		await addPackageToConfig(pkgInfo.name, location);
	} catch (err) {
		// If we errored, remove the package and entry in config and then rethrow the error for the command to handle
		await removePackageFromConfig(pkgInfo.name);
		removeSync(location);
		throw err;
	}
}
