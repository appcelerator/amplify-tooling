import fs from 'fs-extra';

import { extract } from 'tar';
import { isDir, isFile } from 'appcd-fs';
import { join } from 'path';
import { loadConfig, locations } from '@axway/amplify-cli-utils';
import { run, which } from 'appcd-subprocess';

export const cacheDir = join(locations.axwayHome, 'cache');
export const packagesDir = join(locations.axwayHome, 'packages');

const scopedPackageRegex = /@[a-z0-9][\w-.]+\/?/;
/**
 * TODO
 *
 * @param {Object} params - Various options.
 * @param {String} params.directory - The directory to run npm in.
 * @param {String} [params.npm] - The path to the npm. Defaults to resolving npm in the system path.
 */
export async function npmInstall({ directory, npm }) {
	if (!isFile(join(directory, 'package.json'))) {
		const error = new Error('Directory does not contain a package.json');
		error.code = 'ENOPKGJSON';
		throw error;
	}

	if (!npm) {
		try {
			npm = await which('npm');
		} catch (e) {
			const error = new Error('Unable to find the "npm" executable. Please ensure you have "npm" installed on your machine');
			error.code = 'ENONPM';
			throw error;
		}
	}

	// TEMPORARY HACK
	if (process.platform === 'win32') {
		npm = 'npm';
	}

	try {
		const { err, stdout, stderr } = await run(npm, [ 'install', '--production' ], { cwd: directory, shell: true, windowsHide: true });
		if (err) {
			throw err;
		}
	} catch (err) {
		// Add an error code but move the original code value here into an exitCode prop
		err.exitCode = err.code;
		err.code = 'ENPMINSTALLERROR';
		throw err;
	}
}

/**
 * TODO
 *
 * @param {Object} params - Various options.
 * @param {String} params.dest - The directory to extract the archive.
 * @param {String} params.file - The tarball to extract.
 * @param {Object} [params.opts] - Various extract options.
 */
export async function extractTar({ dest, file, opts }) {
	opts = Object.assign({ strip: 1 }, opts, { file, cwd: dest });
	await fs.ensureDir(dest);
	await extract(opts);
}

/**
 * Add a package to the amplify cli config
 *
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

	if (!isDir(path)) {
		throw new Error('Expected package path to exist');
	}
	cfg.set(`extensions.${name}`, path);
	await cfg.save(location);
}

/**
 * Remove a package from the amplify cli config, optionally replacing it with another version.
 *
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

		if (!isDir(replacementPath)) {
			throw new Error('Expected replacementPath to exist');
		}
	}

	// TODO: we should only register a package as an extension if the package IS an extension!

	if (replacementPath) {
		cfg.set(`extensions.${name}`, replacementPath);
	} else {
		cfg.delete(`extensions.${name}`);
	}

	await cfg.save(location);
}

/**
 * Detects installed packages.
 *
 * @param {Config} cfg - The config object.
 * @param {String} pkgsDir - THe directory where packages are stored.
 * @returns {Array.<Object>}
 */
export function getInstalledPackages(cfg = loadConfig(), pkgsDir = packagesDir) {
	const packages = [];
	const activePkgs = cfg.get('extensions', {});

	if (!isDir(pkgsDir)) {
		return packages;
	}

	for (const name of fs.readdirSync(pkgsDir)) {
		const pkgDir = join(pkgsDir, name);
		if (!isDir(pkgDir)) {
			continue;
		}

		if (scopedPackageRegex.test(name)) {
			for (const pkgName of fs.readdirSync(pkgDir)) {
				const dir = join(pkgDir, pkgName);

				if (!isDir(dir)) {
					continue;
				}

				const packageData = getPackageData(`${name}/${pkgName}`, activePkgs, dir);
				if (packageData.version || Object.keys(packageData.versions).length) {
					packages.push(packageData);
				}
			}
		} else {
			const packageData = getPackageData(name, activePkgs, pkgDir);
			if (packageData.version || Object.keys(packageData.versions).length) {
				packages.push(packageData);
			}
		}
	}

	return packages;
}

function getPackageInfo(pluginPath) {
	try {
		const pkgJson = fs.readJSONSync(join(pluginPath, 'package.json'));
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

function getPackageData(name, activePkgs, pkgDir) {
	const packageData = {
		name,
		description: undefined,
		version: undefined,
		versions: {}
	};

	let active = getPackageInfo(activePkgs[name]);

	// If the name is for a scoped package and we have no data
	// look it up also by the name without a scope
	if (!active && scopedPackageRegex.test(name)) {
		name = name.replace(scopedPackageRegex, '');
		active = getPackageInfo(activePkgs[name]);
	}

	if (active) {
		packageData.version = active.version;
	}

	for (const version of fs.readdirSync(pkgDir)) {
		const versionDir = join(pkgDir, version);
		const pkgJsonFile = join(versionDir, 'package.json');

		if (isFile(pkgJsonFile)) {
			try {
				const pkgJson = fs.readJsonSync(pkgJsonFile);
				packageData.description = pkgJson.description;
				packageData.versions[version] = {
					path: versionDir
				};
			} catch (e) {
				// squelch
			}
		}
	}
	return packageData;
}
