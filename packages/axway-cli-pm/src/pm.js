import fs from 'fs-extra';
import npa from 'npm-package-arg';
import npmsearch from 'libnpmsearch';
import pacote from 'pacote';
import path from 'path';
import promiseLimit from 'promise-limit';
import { createRequestOptions, loadConfig, locations } from '@axway/amplify-cli-utils';
import { isDir, isFile } from 'appcd-fs';

const scopedPackageRegex = /^@[a-z0-9][\w-.]+\/?/;

/**
 * The path to the Axway CLI packages directory.
 * @type {String}
 */
export const packagesDir = path.join(locations.axwayHome, 'axway-cli', 'packages');

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
 * Detects all installed packages.
 *
 * @param {String} [packageName] - Name of the package to only return data for.
 * @returns {Promise<Array.<Object>>}
 */
export async function list(packageName) {
	if (!isDir(packagesDir)) {
		return [];
	}

	const extensions = loadConfig().get('extensions', {});
	const packages = [];

	packageName = typeof packageName === 'string' ? packageName.toLowerCase() : packageName;

	for (const name of fs.readdirSync(packagesDir)) {
		const pkgDir = path.join(packagesDir, name);
		if (!isDir(pkgDir)) {
			continue;
		}

		if (scopedPackageRegex.test(name)) {
			for (const pkgSubDir of fs.readdirSync(pkgDir)) {
				const dir = path.join(pkgDir, pkgSubDir);
				const pkgName = `${name}/${pkgSubDir}`;
				if (isDir(dir) && (!packageName || pkgName.toLowerCase() === packageName)) {
					const packageData = loadPackageData(pkgName, extensions, dir);
					if (packageData.version || Object.keys(packageData.versions).length) {
						packages.push(packageData);
					}
				}
			}
		} else if (!packageName || name.toLowerCase() === packageName) {
			const packageData = loadPackageData(name, extensions, pkgDir);
			if (packageData.version || Object.keys(packageData.versions).length) {
				packages.push(packageData);
			}
		}
	}

	return packages;
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
	const packages = await npmsearch([ 'amplify-package', keyword ], {
		...requestOpts,
		limit: Math.max(limit && parseInt(limit, 10) || 50, 1)
	});
	const results = [];

	await Promise.all(packages.map(({ name, version }) => {
		return plimit(async () => {
			const pkg = await view(`${name}@${version}`, { requestOpts, type });
			if (pkg) {
				results.push(pkg);
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
	const info = await pacote.packument(name, {
		...requestOpts,
		fullMetadata: true
	});
	const version = info['dist-tags']?.[fetchSpec] || fetchSpec;
	const pkg = info.versions[version];
	const maintainers = [ 'appcelerator', 'axway-npm' ];

	if (!pkg
		|| !pkg.amplify?.type
		|| (type && pkg.amplify.type !== type)
		|| pkg.keywords.includes('amplify-test-package')
		|| !pkg.keywords.includes('amplify-package')
		|| !pkg.maintainers.some(m => maintainers.includes(m.name))
	) {
		return;
	}

	const installed = (await list(pkg.name))[0];

	return {
		description: pkg.description,
		installed:   installed?.versions || false,
		name:        pkg.name,
		type:        pkg.amplify.type,
		version
	};
}
