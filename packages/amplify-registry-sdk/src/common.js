import fs from 'fs-extra';
import { join } from 'path';

import { loadConfig, locations } from '@axway/amplify-cli-utils';

export const cacheDir = join(locations.axwayHome, 'cache');
export const packagesDir = join(locations.axwayHome, 'packages');

/**
 * Add a package to the amplify cli config
 * @param {String} name - Name of the package.
 * @param {String} path - Path to the package.
 */
export async function addPackageToConfig(name, path) {
	const cfg = loadConfig();
	cfg.set(`extensions.${name}`, path);
	await cfg.save(locations.configFile);
}

/**
 * Remove a package from the amplify cli config, optionally replacing it with another version.
 * @param {String} name - Name of the package to remove/replace.
 * @param {String} [replacementPath] - Path to replace the existing version with.
 */
export async function removePackageFromConfig(name, replacementPath) {
	const cfg = loadConfig();
	if (replacementPath) {
		cfg.set(`extensions.${name}`, replacementPath);
	} else {
		cfg.delete(`extensions.${name}`);
	}
	await cfg.save(locations.configFile);
}

export function getInstalledPackages(wantedName) {
	const plugins = [];
	const cfg = loadConfig();

	const activePkgs = cfg.get('extensions', {});
	for (const name of fs.readdirSync(packagesDir)) {
		const nameDir = join(packagesDir, name);
		if (!fs.statSync(nameDir).isDirectory()) {
			continue;
		}
		const activeData = getPackageInfo(activePkgs[name]);
		let activeVersion;
		if (activeData) {
			activeVersion = activeData.version;
		}
		const pluginData = {
			name,
			versions: [],
			versionInfo: {},
			activeVersion,
			installPath: join(packagesDir, name)
		};
		for (const version of fs.readdirSync(nameDir)) {
			const versionDir = join(nameDir, version);
			if (!fs.statSync(versionDir).isDirectory()) {
				continue;
			}
			pluginData.versions.push(version);
			pluginData.versionInfo[version] = { version, installPath: versionDir };
		}
		plugins.push(pluginData);
	}
	if (wantedName) {
		return plugins[0];
	}
	return plugins;
}

function getPackageInfo(pluginPath) {
	try {
		const pkgJson = fs.readJsonSync(join(pluginPath, 'package.json'));
		return {
			name: pkgJson.name,
			description: pkgJson.description,
			version: pkgJson.version
		};
	} catch (e) {
		// TODO: Do we need our format to allow for non-node packages to give us info?
		return undefined;
	}
}
