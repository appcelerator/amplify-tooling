/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Registry from './registry';

import { fetchAndInstall, PackageInstaller } from './installers';

import {
	addPackageToConfig,
	getInstalledPackages,
	packagesDir,
	removePackageFromConfig
} from './installers/common';

export {
	addPackageToConfig,
	PackageInstaller,
	fetchAndInstall,
	getInstalledPackages,
	packagesDir,
	Registry,
	removePackageFromConfig
};

export default Registry;
