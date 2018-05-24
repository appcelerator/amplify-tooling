import { npmInstall } from '../../common';
import { addPackageToConfig } from '../../../common';

export async function post({ pkgInfo, location }) {
	return await npmInstall({ directory: location })
		.then(addPackageToConfig(pkgInfo.name, location));
}
