import fs from 'fs-extra';
import { homedir } from 'os';
import { join } from 'path';
import { run } from 'appcd-subprocess';

import { config, locations } from '@axway/amplify-cli-utils';

export const cacheDir = join(locations.axwayDir, 'cache');
export const packagesDir = join(locations.axwayDir, 'packages');

export function addPackageToConfig(name, path) {
	const cfg = config.read();
	if (!cfg.extensions) {
		cfg.extensions = {};
	}
	cfg.extensions[name] = path;
	config.write(cfg);
}

export function removePackageFromConfig(name, replacementPath) {
	const cfg = config.read();
	if (!cfg.extensions) {
		cfg.extensions = {};
	}
	if (replacementPath) {
		cfg.extensions[name] = replacementPath;
	} else {
		delete cfg.extensions[name];
	}
	config.write(cfg);
}

export function getInstalledPackages(wantedName) {
	const plugins = [];
	const activePkgs = getActivePackages();
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

export function getActivePackages() {
	const cfg = config.read();
	return cfg.extensions || {};
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
