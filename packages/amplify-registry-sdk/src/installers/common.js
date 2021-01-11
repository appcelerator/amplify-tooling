import fs from 'fs-extra';
import loadConfig from '@axway/amplify-config';
import snooplogg from 'snooplogg';
import which from 'which';

import { createNPMRequestArgs, locations } from '@axway/amplify-cli-utils';
import { extract } from 'tar';
import { isDir, isFile } from 'appcd-fs';
import { join } from 'path';
import { spawn } from 'child_process';

export const cacheDir = join(locations.axwayHome, 'axway-cli', 'cache');
export const packagesDir = join(locations.axwayHome, 'axway-cli', 'packages');

const { log } = snooplogg('registry-sdk:common');
const { highlight } = snooplogg.styles;
const npmErrRE = /npm err/i;
const scopedPackageRegex = /@[a-z0-9][\w-.]+\/?/;

/**
 * Installs the package's production dependencies.
 *
 * @param {Object} params - Various options.
 * @param {String} params.directory - The directory to run npm in.
 * @param {String} [params.npm] - The path to the npm. Defaults to resolving npm in the system path.
 */
export async function npmInstall({ directory, npm }) {
	const pkgJsonFile = join(directory, 'package.json');

	if (!isFile(pkgJsonFile)) {
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

	// npm 7 has started calling the "prepare" script, but since we are only installing production
	// dependencies, "prepare" will likely fail, so we have to remove it
	const pkgJson = await fs.readJson(pkgJsonFile);
	if (pkgJson.scripts) {
		await fs.move(pkgJsonFile, `${pkgJsonFile}.bak`, { overwrite: true });
		delete pkgJson.scripts.prepare;
		await fs.writeJson(pkgJsonFile, pkgJson);
	}

	try {
		const args = [ 'install', '--production', ...createNPMRequestArgs() ];

		await new Promise((resolve, reject) => {
			const opts = {
				cwd: directory,
				env: Object.assign({ NO_UPDATE_NOTIFIER: 1 }, process.env),
				windowsHide: true
			};

			let stdout = '';
			let stderr = '';

			log(`Running PWD=${directory} ${highlight(`${npm} ${args.join(' ')}`)}`);

			const child = spawn(npm, args, opts);
			child.stdout.on('data', data => stdout += data.toString());
			child.stderr.on('data', data => stderr += data.toString());

			child.on('close', code => {
				if (code) {
					const err = new Error(`Subprocess exited with code ${code}`);
					err.command = npm;
					err.args    = args;
					err.opts    = opts;
					err.code    = code;
					err.stdout  = stdout;
					err.stderr  = stderr;
					reject(err);
				} else {
					resolve();
				}
			});
			child.on('error', reject);
		});
	} catch (err) {
		// Add an error code but move the original code value here into an exitCode prop
		err.exitCode = err.code;
		err.code = 'ENPMINSTALLERROR';
		err.message = `Failed to npm install ${highlight(directory)} (code ${err.exitCode})`;

		if (err.stderr) {
			err.message += '\n' + err.stderr.split(/\r\n|\n/).filter(line => npmErrRE.test(line)).join('\n');
		}

		throw err;
	} finally {
		if (fs.existsSync(`${pkgJsonFile}.bak`)) {
			await fs.move(`${pkgJsonFile}.bak`, pkgJsonFile, { overwrite: true });
		}
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
 * Add a package to the Axway CLI config.
 *
 * @param {String} name - Name of the package.
 * @param {String} path - Path to the package.
 * @param {Object} [cfg] - The config object.
 */
export async function addPackageToConfig(name, path, cfg = loadConfig()) {
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
	cfg.save();
}

/**
 * Remove a package from the Axway CLI config, optionally replacing it with another version.
 *
 * @param {String} name - Name of the package to remove/replace.
 * @param {String} [replacementPath] - Path to replace the existing version with.
 * @param {Object} [cfg] - The config object.
 */
export async function removePackageFromConfig(name, replacementPath, cfg = loadConfig()) {
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

	cfg.save();
}

/**
 * Detects installed packages.
 *
 * @param {Object} [options] - Various options.
 * @param {String} [options.packageName] - Name of the package to only return data for.
 * @param {Config} [cfg] - The config object.
 * @param {String} [pkgsDir] - THe directory where packages are stored.
 * @returns {Array.<Object>}
 */
export function getInstalledPackages({ packageName } = {}, cfg = loadConfig(), pkgsDir = packagesDir) {
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

	if (packageName) {
		return packages.filter(pkg => packageName === pkg.name);
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

	for (const version of fs.readdirSync(pkgDir)) {
		const versionDir = join(pkgDir, version);
		const pkgJsonFile = join(versionDir, 'package.json');

		if (isFile(pkgJsonFile)) {
			try {
				const pkgJson = fs.readJsonSync(pkgJsonFile);
				packageData.description = pkgJson.description;
				packageData.versions[version] = {
					path: versionDir,
					managed: true
				};
			} catch (e) {
				// squelch
			}
		}
	}

	if (active) {
		packageData.version = active.version;

		if (!packageData.versions[active.version]) {
			packageData.versions[active.version] = {
				path: activePkgs[name],
				managed: false
			};
		}
	}

	return packageData;
}
