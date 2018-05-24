import { removeSync } from 'fs-extra';
import { npmInstall } from '../../common';
import { addPackageToConfig, removePackageFromConfig } from '../../../common';

export async function post({ pkgInfo, location }) {
	return await npmInstall({ directory: location })
		.then(addPackageToConfig(pkgInfo.name, location))
		.catch(async (err) =>  {
			console.log(err);
			// If we errored, remove the package and entry in config
			await removePackageFromConfig(pkgInfo.name);
			removeSync(location);
		});
}
