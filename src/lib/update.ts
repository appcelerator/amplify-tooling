import path from 'path';
import semver from 'semver';
import logger, { highlight } from './logger.js';
import * as request from './request.js';
import { isCI } from 'ci-info';
import tmp from 'tmp';
import { readJsonSync, writeFileSync } from './fs.js';

const { error, log, warn } = logger('update');

let pendingCheck: Promise<UpdateMeta>;

interface UpdateMeta {
	latest: string | null;
	lastCheck: number | null;
	updateAvailable: boolean;
	current: string;
	distTag: string;
	name: string;
}

/**
 * Checks if there's an new version of a package is available.
 *
 * @param {Object} [opts] - Various options.
 * @param {Boolean} [opts.applyOwner=true] - When `true`, determines the owner of the closest
 * existing parent directory and apply the owner to the file and any newly created directories.
 * @param {String} [opts.caFile] - A path to a PEM-formatted certificate authority bundle.
 * @param {String} [opts.certFile] - A path to a client cert file used for authentication.
 * @param {Number} [opts.checkInterval=3600000] - The amount of time in milliseconds before
 * checking for an update. Defaults to 1 hour.
 * @param {String} [opts.distTag='latest'] - The tag to check for the latest version.
 * @param {Boolean} [opts.force=false] - Forces an update check.
 * @param {String} [opts.keyFile] - A path to a private key file used for authentication.
 * @param {String} [opts.metaDir] - The directory to store package update information.
 * @param {Object|String} [opts.pkg] - The parsed `package.json`, path to the package.json file, or
 * falsey and it will scan parent directories looking for a package.json.
 * @param {String} [opts.proxy] - A proxy server URL. Can be `http` or `https`.
 * @param {String} [opts.registryUrl] - The npm registry URL. By default, it will autodetect the
 * URL based on the package name/scope.
 * @param {Boolean} [opts.strictSSL=true] - When falsey, disables TLS/SSL certificate validation
 * for both `https` requests and `https` proxy servers.
 * @param {Number} [opts.timeout=1000] - The number of milliseconds to wait to query npm before
 * timing out.
 * @returns {Promise} Resolves an object containing the update information.
 */
export async function _check(opts: any = {}): Promise<UpdateMeta> {
	if (!opts || typeof opts !== 'object') {
		throw new TypeError('Expected options to be an object');
	}

	let {
		checkInterval = 3600000, // 1 hour
		distTag = 'latest',
		force,
		metaDir,
		pkg
	} = opts;

	delete opts.checkInterval;
	delete opts.distTag;
	delete opts.force;
	delete opts.metaDir;
	delete opts.pkg;

	// bail immediately if update notifications have been explicitly disabled or we're running
	// within a test
	if (!force && !process.env.FORCE_UPDATE_NOTIFIER && (process.env.NO_UPDATE_NOTIFIER || process.env.NODE_ENV === 'test' || isCI)) {
		return {} as UpdateMeta;
	}

	if (!pkg || typeof pkg !== 'object' || !pkg.name || !pkg.version) {
		throw new TypeError('Expected pkg to be an object containing name and version properties');
	}

	if (!distTag || typeof distTag !== 'string') {
		throw new TypeError('Expected distTag to be a non-empty string');
	}

	// determine the meta directory
	if (!metaDir) {
		metaDir = process.env.TEST_META_DIR || path.join(tmp.tmpdir, 'check-kit');
	} else if (typeof metaDir !== 'string') {
		throw new TypeError('Expected metaDir to be a string');
	}

	// load the package.json
	const { name, version } = pkg;
	if (!name || typeof name !== 'string') {
		throw new Error('Expected name in package.json to be a non-empty string');
	}
	if (!version || typeof version !== 'string') {
		throw new Error('Expected version in package.json to be a non-empty string');
	}

	const now = Date.now();
	const metaFile = path.resolve(metaDir, `${name.replace(/[/\\]/g, '-')}-${distTag}.json`);

	const meta: UpdateMeta = Object.assign(
		{
			latest: null,
			lastCheck: null,
			updateAvailable: false
		},
		loadMetaFile(metaFile),
		{
			current: version,
			distTag,
			name
		}
	);

	// get the latest version from npm if:
	//  - forcing update
	//  - or there is no meta data
	//  - or there's no last check timestamp
	//  - or the last check is > check interval
	if (force || !meta.lastCheck || (now > meta.lastCheck + checkInterval)) {
		try {
			meta.latest = await getLatestVersion(name, distTag, opts);
			meta.lastCheck = now;
		} catch (err) {
			// check if we're offline
			/* istanbul ignore if */
			if (err.code === 'ENOTFOUND') {
				warn(err.message);
			} else {
				throw err;
			}
		}
	}

	meta.updateAvailable = meta.latest ? semver.gt(meta.latest, version) : false;
	writeFileSync(metaFile, JSON.stringify(meta, null, 2), { applyOwner: opts.applyOwner });

	if (meta.updateAvailable) {
		log(`${highlight(`${name}@${version}`)} has newer version ${highlight(meta.latest)} available`);
	} else if (meta.latest) {
		log(`${highlight(`${name}@${version}`)} is already the latest version (${meta.latest})`);
	} else {
		log(`${highlight(`${name}@${version}`)} not found`);
	}

	return meta;
}

/**
 * Checks if there's an new version of a package is available.
 *
 * @param {Object} [opts] - Various options.
 * @param {Boolean} [opts.applyOwner=true] - When `true`, determines the owner of the closest
 * existing parent directory and apply the owner to the file and any newly created directories.
 * @param {String} [opts.caFile] - A path to a PEM-formatted certificate authority bundle.
 * @param {String} [opts.certFile] - A path to a client cert file used for authentication.
 * @param {Number} [opts.checkInterval=3600000] - The amount of time in milliseconds before
 * checking for an update. Defaults to 1 hour.
 * @param {String} [opts.distTag='latest'] - The tag to check for the latest version.
 * @param {Boolean} [opts.force=false] - Forces an update check.
 * @param {String} [opts.keyFile] - A path to a private key file used for authentication.
 * @param {String} [opts.metaDir] - The directory to store package update information.
 * @param {Object|String} [opts.pkg] - The parsed `package.json`, path to the package.json file, or
 * falsey and it will scan parent directories looking for a package.json.
 * @param {String} [opts.proxy] - A proxy server URL. Can be `http` or `https`.
 * @param {String} [opts.registryUrl] - The npm registry URL. By default, it will autodetect the
 * URL based on the package name/scope.
 * @param {Boolean} [opts.strictSSL=true] - When falsey, disables TLS/SSL certificate validation
 * for both `https` requests and `https` proxy servers.
 * @param {Number} [opts.timeout=1000] - The number of milliseconds to wait to query npm before
 * timing out.
 * @returns {Promise<UpdateMeta>} Resolves an object containing the update information.
 */
export default function check(opts: any): Promise<UpdateMeta> {
	if (!pendingCheck) {
		pendingCheck = _check(opts);
	}
	return pendingCheck;
}

/**
 * Clears the pending update check.
 * This is primarily used for testing.
 */
export function clearPendingCheck() {
	pendingCheck = null;
}

/**
 * Loads the specified meta file and sanity checks it.
 *
 * @param {String} metaFile - The path of the file to load.
 * @returns {Object}
 */
function loadMetaFile(metaFile): UpdateMeta | null {
	try {
		// read the meta file
		log(`Loading meta file: ${highlight(metaFile)}`);
		const meta = readJsonSync(metaFile);
		if (meta && typeof meta === 'object') {
			return meta;
		}
	} catch (e) {
		// meta file does not exist or is malformed
	}

	return null;
}

/**
 * Retrieves the latest version associated with the specified dist tag.
 *
 * @param {String} name - The package name.
 * @param {String} distTag - The name of the distribution tag to return.
 * @param {Object} [opts] - Options to initialized the request client.
 * @returns {Promise<String | null>} Resolves the latest version or `null` if not found.
 */
async function getLatestVersion(name, distTag, opts): Promise<string | null> {
	const regUrl = 'https://registry.npmjs.org/';
	const got = request.init(opts);
	const reqOpts = {
		followRedirect: true,
		headers: {
			accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*'
		},
		responseType: 'json',
		retry: { limit: 0 },
		timeout: Object.prototype.hasOwnProperty.call(opts, 'timeout') ? opts.timeout : { request: 1000 },
		url: new URL(encodeURIComponent(name).replace(/^%40/, '@'), regUrl)
	} as any;

	try {
		const { body: info }: any = await got(reqOpts);

		if (!info || typeof info !== 'object') {
			throw new TypeError('Expected registry package info to be an object');
		}

		const version = info['dist-tags']?.[distTag];
		if (!version) {
			throw new Error(`Distribution tag "${distTag}" does not exist`);
		}

		return version;
	} catch (err) {
		if (err.code === 'ECONNREFUSED') {
			err.message = `Failed to connect to npm registry: ${err.message}`;
			throw err;
		}

		if (!err.response || !String(err.response.statusCode).startsWith('4')) {
			error(`Failed to query registry: ${err.message}`);
			throw err;
		}

		if (err.response.statusCode === 404) {
			const error: any = new Error(`Response code ${err.response.statusCode} (${err.response.statusMessage})`);
			error.code = 'ENOTFOUND';
			throw error;
		}

		return null;
	}
}
