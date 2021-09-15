import fs from 'fs-extra';
import npa from 'npm-package-arg';
import npmsearch from 'libnpmsearch';
import pacote from 'pacote';
import path from 'path';
import promiseLimit from 'promise-limit';
import semver from 'semver';
import snooplogg from 'snooplogg';
import spawn from 'cross-spawn';
import which from 'which';
import { createNPMRequestArgs, createRequestOptions, loadConfig, locations } from '@axway/amplify-cli-utils';
import { EventEmitter } from 'events';
import { isDir, isFile, mkdirpSync } from '@axway/amplify-utils';

const scopedPackageRegex = /^@[a-z0-9][\w-.]+\/?/;
const { error, log } = snooplogg('pm');
const { alert, highlight } = snooplogg.styles;

/**
 * The path to the Axway CLI packages directory.
 * @type {String}
 */
export const packagesDir = path.join(locations.axwayHome, 'axway-cli', 'packages');

/**
 * Finds a specific installed package.
 *
 * @param {String} packageName - The name of the package to find.
 * @returns {Object}
 */
export function find(packageName) {
	if (!packageName || typeof packageName !== 'string') {
		throw new TypeError('Expected package name to be a non-empty string');
	}

	if (!isDir(packagesDir)) {
		return undefined;
	}

	const extensions = loadConfig().get('extensions', {});

	packageName = packageName.toLowerCase();

	for (const name of fs.readdirSync(packagesDir)) {
		const pkgDir = path.join(packagesDir, name);
		if (!isDir(pkgDir)) {
			continue;
		}

		if (scopedPackageRegex.test(name)) {
			for (const pkgSubDir of fs.readdirSync(pkgDir)) {
				const dir = path.join(pkgDir, pkgSubDir);
				const pkgName = `${name}/${pkgSubDir}`;
				if (isDir(dir) && pkgName.toLowerCase() === packageName) {
					const packageData = loadPackageData(pkgName, extensions, dir);
					if (packageData.version || Object.keys(packageData.versions).length) {
						return packageData;
					}
				}
			}
		} else if (name.toLowerCase() === packageName) {
			const packageData = loadPackageData(name, extensions, pkgDir);
			if (packageData.version || Object.keys(packageData.versions).length) {
				return packageData;
			}
		}
	}
}

/**
 * Installs a package from npm.
 *
 * @param {String} pkgName - The package and version to install.
 * @returns {EventEmitter}
 */
export function install(pkgName) {
	const emitter = new EventEmitter();

	setImmediate(async () => {
		let cfg = loadConfig();
		let previousActivePackage;
		let info;

		try {
			info = await view(pkgName);

			let npm;
			try {
				npm = await which('npm');
			} catch (e) {
				const err = new Error('Unable to find the "npm" executable. Please ensure you have "npm" installed on your machine');
				err.code = 'ENONPM';
				throw err;
			}

			previousActivePackage = cfg.get(`extensions.${info.name}`);

			info.path = path.join(packagesDir, info.name, info.version);
			mkdirpSync(info.path);

			emitter.emit('download', info);
			await pacote.extract(`${info.name}@${info.version}`, info.path, createRequestOptions());

			emitter.emit('install', info);
			const args = [
				'install',
				'--production',
				...createNPMRequestArgs()
			];
			const opts = {
				cwd: info.path,
				env: Object.assign({ NO_UPDATE_NOTIFIER: 1 }, process.env),
				gid: process.env.SUDO_GID ? parseInt(process.env.SUDO_GID) : undefined,
				uid: process.env.SUDO_UID ? parseInt(process.env.SUDO_UID) : undefined,
				windowsHide: true
			};

			log(`node ${highlight(process.version)} npm ${highlight(spawn.sync('npm', [ '-v' ], opts).stdout.toString().trim())}`);
			log(`Running PWD=${info.path} ${highlight(`${npm} ${args.join(' ')}`)}`);
			await new Promise((resolve, reject) => {
				let stderr = '';
				const child = spawn(npm, args, opts);

				child.stdout.on('data', data => log(data.toString().trim()));
				child.stderr.on('data', data => {
					const s = data.toString();
					stderr += s;
					log(s.trim());
				});

				child.on('close', status => {
					if (status) {
						reject(new Error(`${stderr ? String(stderr.split(/\r\n|\n/)[0]).replace(/^\s*error:\s*/i, '') : 'unknown error'} (code ${status})`));
					} else {
						resolve();
					}
				});
			});

			emitter.emit('register', info);
			cfg = loadConfig();
			cfg.set(`extensions.${info.name}`, info.path);
			cfg.save();

			emitter.emit('end', info);
		} catch (err) {
			if (info) {
				if (previousActivePackage === info.path) {
					// package was reinstalled, but failed and directory is in an unknown state
					cfg = loadConfig();
					cfg.delete(`extensions.${info.name}`);
					cfg.save();
				} else if (previousActivePackage) {
					// restore the previous value
					cfg = loadConfig();
					cfg.set(`extensions.${info.name}`, previousActivePackage);
					cfg.save();
				}

				if (info.path) {
					await fs.remove(info.path);
				}
			}

			emitter.emit('error', err);
		}
	});

	return emitter;
}

/**
 * Detects all installed packages.
 *
 * @returns {Promise<Array.<Object>>}
 */
export async function list() {
	if (!isDir(packagesDir)) {
		return [];
	}

	const extensions = loadConfig().get('extensions', {});
	const packages = [];

	for (const name of fs.readdirSync(packagesDir)) {
		const pkgDir = path.join(packagesDir, name);
		if (!isDir(pkgDir)) {
			continue;
		}

		if (scopedPackageRegex.test(name)) {
			for (const pkgSubDir of fs.readdirSync(pkgDir)) {
				const dir = path.join(pkgDir, pkgSubDir);
				const pkgName = `${name}/${pkgSubDir}`;
				if (isDir(dir)) {
					const packageData = loadPackageData(pkgName, extensions, dir);
					if (packageData.version || Object.keys(packageData.versions).length) {
						packages.push(packageData);
					}
				}
			}
		} else {
			const packageData = loadPackageData(name, extensions, pkgDir);
			if (packageData.version || Object.keys(packageData.versions).length) {
				packages.push(packageData);
			}
		}
	}

	return packages;
}

/**
 * Determines if there are any older versions of packages installed that could be purged.
 *
 * @param {String} [pkgName] - A specific package to check if purgable, otherwise checks all
 * packages.
 * @returns {Object}
 */
export async function listPurgable(pkgName) {
	let packages = [];

	if (pkgName) {
		const pkg = await find(pkgName);
		if (!pkg) {
			throw new Error(`Package "${pkgName}" is not installed`);
		}
		packages.push(pkg);
	} else {
		packages = await list();
	}

	const purgable = {};

	for (const { name, version, versions } of packages) {
		for (const [ ver, versionData ] of Object.entries(versions)) {
			// if managed and not in use
			if (versionData.managed && versionData.path.startsWith(packagesDir) && semver.neq(ver, version)) {
				if (!purgable[name]) {
					purgable[name] = [];
				}
				purgable[name].push({
					...versionData,
					version: ver
				});
			}
		}
	}

	return purgable;
}

/**
 * Scans a package directory for all installed versions.
 *
 * @param {String} name - The package name.
 * @param {Object} extensions - An object of registered extension names and their paths.
 * @param {String} pkgDir - The path to the package.
 * @returns {Object}
 */
function loadPackageData(name, extensions, pkgDir) {
	const packageData = {
		name,
		description: undefined,
		version: undefined,
		versions: {}
	};

	// find all versions
	for (const version of fs.readdirSync(pkgDir)) {
		try {
			const versionDir = path.join(pkgDir, version);
			const pkgJson = fs.readJsonSync(path.join(versionDir, 'package.json'));
			packageData.description = pkgJson.description;
			packageData.versions[version] = {
				path: versionDir,
				managed: true
			};
		} catch (e) {
			// squelch
		}
	}

	// see if this package is an extension and if it's the currently selected version
	let extPath = extensions[name];
	if (!extPath) {
		name = name.replace(scopedPackageRegex, '');
		extPath = extensions[name];
	}
	if (extPath) {
		const pkgJsonFile = path.join(extPath, 'package.json');
		if (isFile(pkgJsonFile)) {
			const { version } = fs.readJsonSync(pkgJsonFile);
			packageData.version = version;
			if (!packageData.versions[version]) {
				packageData.versions[version] = {
					path: extPath,
					managed: false
				};
			}
		}
	}

	return packageData;
}

/**
 * Uninstalls a package.
 *
 * @param {String} dir - Path to the package to delete.
 * @returns {Promise}
 */
export async function uninstallPackage(dir) {
	try {
		const pkgJson = await fs.readJson(path.join(dir, 'package.json'));
		if (pkgJson.scripts.uninstall) {
			log(`Running npm uninstall script: ${highlight(pkgJson.scripts.uninstall)}`);
			const { status, stderr } = spawn.sync('npm', [ 'run', 'uninstall' ], { cwd: dir });
			if (status) {
				error(alert('Failed to run npm uninstall script:'));
				error(stderr);
			}
		}
	} catch (e) {
		// squelch
	}

	await fs.remove(dir);
}

/**
 * Searches npm for Axway CLI packages.
 *
 * @param {Object} [opts] - Various options.
 * @param {String} [opts.keyword] - A keyword to search for.
 * @param {Number} [opts.limit=50] - The max number of results to return.
 * @param {String} [opts.type] - A package type to filter by.
 * @returns {Promse<Array.<Object>>}
 */
export async function search({ keyword, limit, type } = {}) {
	const plimit = promiseLimit(10);
	const requestOpts = createRequestOptions();
	const keywords = [ 'amplify-package' ];
	if (process.env.TEST) {
		keywords.push('amplify-test-package');
	}
	if (keyword) {
		keywords.push(keyword);
	}
	const packages = await npmsearch(keywords, {
		...requestOpts,
		limit: Math.max(limit && parseInt(limit, 10) || 50, 1)
	});
	const results = [];

	await Promise.all(packages.map(({ name, version }) => {
		return plimit(async () => {
			try {
				const pkg = await view(`${name}@${version}`, { requestOpts, type });
				if (pkg) {
					results.push(pkg);
				}
			} catch (err) {
				// squelch
			}
		});
	}));

	return results.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetches package information directly from npm and checks that it's a valid package.
 *
 * @param {String} pkgName - The package name.
 * @param {Object} [opts] - Various options.
 * @param {Object} [opts.requestOpts] - HTTP request options.
 * @param {String} [opts.type] - The package type to filter by.
 */
export async function view(pkgName, { requestOpts = createRequestOptions(), type } = {}) {
	if (!pkgName || typeof pkgName !== 'string') {
		throw new TypeError('Expected package name to be a non-empty string');
	}

	const { name, fetchSpec } = npa(pkgName);
	let info;

	if (!name) {
		throw new Error(`Invalid package name "${pkgName}"`);
	}

	try {
		info = await pacote.packument(name, {
			...requestOpts,
			fullMetadata: true
		});
	} catch (err) {
		if (err.statusCode === 404) {
			throw new Error(`Package "${pkgName}" not found`);
		}
		throw err;
	}

	const version = info['dist-tags']?.[fetchSpec] || fetchSpec;
	const pkg = info.versions[version];
	const maintainers = [ 'appcelerator', 'axway-npm' ];

	if (!pkg
		|| !pkg.amplify?.type
		|| (type && pkg.amplify.type !== type)
		|| (pkg.keywords.includes('amplify-test-package') && !process.env.TEST)
		|| !pkg.keywords.includes('amplify-package')
		|| !pkg.maintainers.some(m => maintainers.includes(m.name))
	) {
		throw new Error(`Package "${pkgName}" not found`);
	}

	const installed = find(pkg.name);

	return {
		description: pkg.description,
		installed:   installed?.versions || false,
		name:        pkg.name,
		type:        pkg.amplify.type,
		version,
		versions:    Object.keys(info.versions)
	};
}
