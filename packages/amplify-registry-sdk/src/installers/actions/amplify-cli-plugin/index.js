import loadConfig from '@axway/amplify-config';

import { addPackageToConfig, npmInstall, removePackageFromConfig } from '../../common';
import { removeSync } from 'fs-extra';

export async function post({ pkgInfo, location }) {
	const cfg = loadConfig();
	const previousActivePackage = cfg.get(`extensions.${pkgInfo.name}`, undefined);
	try {
		await npmInstall({ directory: location });
		await addPackageToConfig(pkgInfo.name, location);
	} catch (err) {
		// If we error during the above steps:
		// 	- If the location to set is the currently active version remove it
		//	- Else if there was a version set, make sure it is set as the active
		// Then rethrow the error to allow the command implementation to handle it appropriately
		if (previousActivePackage === location) {
			await removePackageFromConfig(pkgInfo.name);
		} else if (previousActivePackage && previousActivePackage !== location) {
			await addPackageToConfig(pkgInfo.name, previousActivePackage);
		}
		removeSync(location);
		throw err;
	}
}
