/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Registry from './registry';

import { PackageInstaller } from './installers';

import {
	addPackageToConfig,
	getInstalledPackages,
	removePackageFromConfig
} from './installers/common';

export {
	addPackageToConfig,
	PackageInstaller,
	getInstalledPackages,
	Registry,
	removePackageFromConfig
};

export default Registry;
