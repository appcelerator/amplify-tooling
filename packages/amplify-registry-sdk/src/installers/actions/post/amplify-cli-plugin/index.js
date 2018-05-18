import { npmInstall } from '../../../common';
import { addPackageToConfig } from '../../../../common';

export async function run({ pkgInfo, location }) {
	return await npmInstall({ directory: location })
		.then(() => {
			addPackageToConfig(pkgInfo.name, location);
		});
}
