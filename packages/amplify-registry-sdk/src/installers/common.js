
import { existsSync, ensureDirSync, readdirSync, readJSONSync, statSync } from 'fs-extra';
import { extract } from 'tar';
import { join } from 'path';
import { loadConfig, locations } from '@axway/amplify-cli-utils';
import { run, which } from 'appcd-subprocess';

export const cacheDir = join(locations.axwayHome, 'cache');
export const packagesDir = join(locations.axwayHome, 'packages');

export async function npmInstall({ directory, npm }) {

	if (!npm) {
		try {
			npm = await which('npm');
		} catch (e) {
			const error = new Error('Unable to find the "npm" executable. Please ensure you have "npm" installed on your machine');
			error.code = 'ENONPM';
			throw error;
		}
	}

	try {
		const { err, stdout, stderr } = await run(npm, [ 'install', '--production' ], { cwd: directory, shell: true, windowsHide: true });

		if (err) {
			throw err;
		}
	} catch (err) {
		// Add a error code but move the original code value here into an exitCode prop
		err.exitCode = err.code;
		err.code = 'ENPMINSTALLERROR';
		throw err;
	}
}

export async function extractTar({ file, dest, opts }) {
	try {
		opts = Object.assign({ strip: 1 }, opts, { file, cwd: dest });
		ensureDirSync(dest);
		return await extract(opts);
	} catch (err) {
		throw err;
	}
}

/**
 * Add a package to the amplify cli config
 * @param {String} name - Name of the package.
 * @param {String} path - Path to the package.
 */
export async function addPackageToConfig(name, path, cfg = loadConfig(), location = locations.configFile) {

	if (!name || typeof name !== 'string') {
		throw new TypeError('Expected name to be a valid string');
	}

	if (!path || typeof path !== 'string') {
		throw new TypeError('Expected path to be a valid string');
	}

	if (!existsSync(path)) {
		throw new Error('Expected package path to exist');
	}

	cfg.set(`extensions.${name}`, path);
	await cfg.save(location);
}

/**
 * Remove a package from the amplify cli config, optionally replacing it with another version.
 * @param {String} name - Name of the package to remove/replace.
 * @param {String} [replacementPath] - Path to replace the existing version with.
 */
export async function removePackageFromConfig(name, replacementPath, cfg = loadConfig(), location = locations.configFile) {

	if (!name || typeof name !== 'string') {
		throw new TypeError('Expected name to be a valid string');
	}

	if (replacementPath) {
		if (typeof replacementPath !== 'string') {
			throw new TypeError('Expected replacementPath to be a valid string');
		}

		if (!existsSync(replacementPath)) {
			throw new Error('Expected replacementPath to exist');
		}
	}

	if (replacementPath) {
		cfg.set(`extensions.${name}`, replacementPath);
	} else {
		cfg.delete(`extensions.${name}`);
	}
	await cfg.save(location);
}

export function getInstalledPackages(cfg = loadConfig(), pkgDir = packagesDir) {
	const packages = [];
	const activePkgs = cfg.get('extensions', {});
	for (const name of readdirSync(pkgDir)) {
		const nameDir = join(pkgDir, name);

		if (!statSync(nameDir).isDirectory()) {
			continue;
		}

		const activeData = getPackageInfo(activePkgs[name]);
		let activeVersion;

		if (activeData) {
			activeVersion = activeData.version;
		}

		const packageData = {
			name,
			versions: [],
			versionInfo: {},
			activeVersion,
			activePath: join(pkgDir, name, activeVersion)
		};

		for (const version of readdirSync(nameDir)) {
			const versionDir = join(nameDir, version);

			if (!statSync(versionDir).isDirectory()) {
				continue;
			}

			packageData.versions.push(version);
			packageData.versionInfo[version] = { version, installPath: versionDir };
		}
		packages.push(packageData);
	}
	return packages;
}

function getPackageInfo(pluginPath) {
	try {
		const pkgJson = readJSONSync(join(pluginPath, 'package.json'));
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
