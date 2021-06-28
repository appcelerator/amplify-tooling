/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import AmplifySDK from '@axway/amplify-sdk';
import boxen from 'boxen';
import check from 'check-kit';
import fs from 'fs';
import loadConfig, { Config } from '@axway/amplify-config';
import snooplogg from 'snooplogg';
import { ansi } from 'cli-kit';
import * as environments from './environments';
import * as locations from './locations';
import * as request from '@axway/amplify-request';

export {
	AmplifySDK,
	Config,
	environments,
	loadConfig,
	locations,
	request
};

const { warn } = snooplogg('amplify-cli-utils');
const { cyan, gray, green } = snooplogg.chalk;

/**
 * Constructs a parameters object to pass into an Auth instance.
 *
 * @param {Object} [opts] - User option overrides.
 * @param {Config} [config] - The Amplify config object.
 * @returns {Object}
 */
export function buildAuthParams(opts = {}, config) {
	if (!opts || typeof opts !== 'object') {
		throw new Error('Expected options to be an object');
	}

	if (!config) {
		config = loadConfig();
	}

	const env = environments.resolve(opts.env || config.get('env'));

	const { clientId, realm } = env.auth;
	const params = {};
	const props = {
		baseUrl:                 undefined,
		clientId,
		clientSecret:            undefined,
		env:                     env.name,
		interactiveLoginTimeout: undefined,
		homeDir:                 locations.axwayHome,
		password:                undefined,
		platformUrl:             undefined,
		realm,
		secretFile:              undefined,
		serverHost:              undefined,
		serverPort:              undefined,
		serviceAccount:          undefined,
		tokenRefreshThreshold:   undefined,
		tokenStore:              undefined,
		tokenStoreDir:           locations.axwayHome,
		tokenStoreType:          undefined,
		username:                undefined
	};

	for (const prop of Object.keys(props)) {
		params[prop] = opts[prop] || config.get(`auth.${prop}`, props[prop]);
	}

	// detect if we're headless and default token store type to `file`
	if (params.tokenStoreType === undefined && isHeadless()) {
		params.tokenStoreType = 'file';
		config.set('auth.tokenStoreType', 'file');
		try {
			config.save();
		} catch (err) {
			warn(err);
		}
	}

	params.requestOptions = createRequestOptions(opts, config);

	return params;
}

// `buildParams()` is too ambiguous, so it was renamed to `buildAuthParams()`, but we still need to
// maintain backwards compatibility
export { buildAuthParams as buildParams };

/**
 * Checks if a new version of an npm package is available and returns a string with the formatted
 * update message.
 *
 * @param {Object} [opts] - Check update and request configuration options.
 * @param {Number} [opts.checkInterval=3600000] - The amount of time in milliseconds before
 * checking for an update. Defaults to 1 hour.
 * @param {String} [opts.cwd] - The current working directory used to locate the `package.json` if
 * `pkg` is not specified.
 * @param {String} [opts.distTag='latest'] - The tag to check for the latest version.
 * @param {Boolean} [opts.force=false] - Forces an update check.
 * @param {String} [opts.metaDir] - The directory to store package update information.
 * @param {Object|String} [opts.pkg] - The parsed `package.json`, path to the package.json file, or
 * falsey and it will scan parent directories looking for a package.json.
 * @param {String} [opts.registryUrl] - The npm registry URL. By default, it will autodetect the
 * URL based on the package name/scope.
 * @param {Number} [opts.timeout=1000] - The number of milliseconds to wait to query npm before
 * timing out.
 * @param {Config} [config] - An Amplify Config instance. If not specified, the config is loaded
 * from disk.
 * @returns {String}
 */
export async function checkForUpdate(opts, config) {
	opts = createRequestOptions(opts, config || loadConfig());

	const {
		current,
		latest,
		name,
		updateAvailable
	} = await check(opts);

	if (updateAvailable) {
		const msg = `Update available ${gray(current)} → ${green(latest)}\nRun ${cyan(`npm i -g ${name}`)} to update`;
		return boxen(msg, {
			align: 'center',
			borderColor: 'yellow',
			borderStyle: 'round',
			margin: { bottom: 1, left: 4, right: 4, top: 1 },
			padding: { bottom: 1, left: 4, right: 4, top: 1 }
		});
	}
}

/**
 * Builds an array of Axway CLI network settings for use as command line arguments when spawning
 * `npm`.
 *
 * @param {Object} [opts] - Request configuration options to override the Axway CLI config
 * settings.
 * @param {Config} [config] - An Amplify Config instance. If not specified, the config is loaded
 * from disk.
 * @returns {Array.<String>}
 */
export function createNPMRequestArgs(opts, config) {
	const { ca, cert, key, proxy, strictSSL } = createRequestOptions(opts, config);
	const args = [];

	if (ca) {
		args.push('--ca', ca.toString());
	}
	if (cert) {
		args.push('--cert', cert.toString());
	}
	if (proxy) {
		args.push('--https-proxy', proxy);
	}
	if (key) {
		args.push('--key', key.toString());
	}
	args.push('--strict-ssl', String(strictSSL !== false));

	return args;
}

/**
 * Load the config file and initializes a `got` instance for making HTTP calls using the network
 * settings from the Axway CLI config file.
 *
 * @param {Object} [opts] - `got` option to override the Axway CLI config settings.
 * @param {Config} [config] - An Amplify Config instance. If not specified, the config is loaded
 * from disk.
 * @returns {Function}
 */
export function createRequestClient(opts, config) {
	opts = createRequestOptions(opts, config);
	return request.init({
		...opts,
		https: {
			certificate: opts.cert,
			key: opts.key,
			...opts.https
		}
	});
}

/**
 * Loads the Axway CLI config file and construct the options for the various Node.js HTTP clients
 * including `pacote`, `npm-registry-fetch`, `make-fetch-happen`, and `request`.
 *
 * @param {Object} [opts] - Request configuration options to override the Axway CLI config
 * settings.
 * @param {Config} [config] - An Amplify Config instance. If not specified, the config is loaded
 * from disk.
 * @returns {Object}
 */
export function createRequestOptions(opts = {}, config) {
	if (opts instanceof Config) {
		config = opts;
		opts = {};
	} else if (!opts && typeof opts !== 'object') {
		throw new TypeError('Expected options to be an object');
	} else {
		opts = { ...opts };
	}

	if (config && !(config instanceof Config)) {
		throw new TypeError('Expected config to be an Amplify Config instance');
	}

	const load = (src, dest) => {
		if (opts[dest] !== undefined) {
			return;
		}
		if (!config) {
			config = loadConfig();
		}
		const value = config.get(src);
		if (value === undefined) {
			return;
		}
		if (dest === 'proxy') {
			opts[dest] = value;
		} else if (dest === 'strictSSL') {
			opts[dest] = !!value !== false;
		} else {
			opts[dest] = fs.readFileSync(value);
		}
	};

	load('network.caFile',     'ca');
	load('network.certFile',   'cert');
	load('network.keyFile',    'key');
	load('network.proxy',      'proxy');
	load('network.httpsProxy', 'proxy');
	load('network.httpProxy',  'proxy');
	load('network.strictSSL',  'strictSSL');

	return opts;
}

/**
 * Creates a table with default styles and padding.
 *
 * @param {Array.<String>} head - One or more headings.
 * @param {Number} [indent] - The number of spaces to indent the table.
 * @returns {Table}
 */
export function createTable(head, indent = 0) {
	const Table = require('cli-table3');
	return new Table({
		chars: {
			bottom: '', 'bottom-left': '', 'bottom-mid': '', 'bottom-right': '',
			left: ' '.repeat(indent), 'left-mid': '',
			mid: '', 'mid-mid': '', middle: '  ',
			right: '', 'right-mid': '',
			top: '', 'top-left': '', 'top-mid': '', 'top-right': ''
		},
		head: Array.isArray(head) ? head.map(ansi.toUpperCase) : head,
		style: {
			border: [],
			head: [],
			'padding-left': 0,
			'padding-right': 0
		}
	});
}

/**
 * Highlights the difference between two versions.
 *
 * @param {String} toVer - The latest version.
 * @param {String} fromVer - The current version.
 * @returns {String}
 */
export function hlVer(toVer, fromVer) {
	const { green } = snooplogg.styles;
	const version = [];

	let [ from, fromTag ] = fromVer.split(/-(.+)/);
	from = from.replace(/[^.\d]/g, '').split('.').map(x => parseInt(x));

	let [ to, toTag ] = toVer.split(/-(.+)/);
	const toMatch = to.match(/^([^\d]+)?(.+)$/);
	to = (toMatch ? toMatch[2] : to).split('.').map(x => parseInt(x));

	const tag = () => {
		if (toTag) {
			const toNum = toTag.match(/\d+$/);
			const fromNum = fromTag && fromTag.match(/\d+$/);
			if (fromNum && parseInt(fromNum[0]) >= parseInt(toNum)) {
				return `-${toTag}`;
			} else {
				return green(`-${toTag}`);
			}
		}
		return '';
	};

	while (to.length) {
		if (to[0] > from[0]) {
			if (version.length) {
				return (toMatch && toMatch[1] || '') + version.concat(green(to.join('.') + tag())).join('.');
			}
			return green((toMatch && toMatch[1] || '') + to.join('.') + tag());
		}
		version.push(to.shift());
		from.shift();
	}

	return (toMatch && toMatch[1] || '') + version.join('.') + tag();
}

/**
 * Loads the config and creates an Amplify SDK object, then returns both of them.
 *
 * @param {Object} [opts] - SDK options including `env` and auth options.
 * @param {Object} [config] - The Amplify config. If not passed in, the config file is loaded.
 * @returns {Object} Returns an object containing the Axway CLI config and an initialized
 * Amplify SDK instance.
 */
export function initSDK(opts = {}, config) {
	if (!config) {
		config = loadConfig();
	}

	return {
		config,
		sdk: new AmplifySDK(buildAuthParams(opts, config))
	};
}

/**
 * Detects if the current terminal is headless (e.g. a Docker container or SSH session).
 *
 * @returns {Boolean}
 */
export function isHeadless() {
	try {
		if (process.platform === 'linux' && (process.env.SSH_TTY || !process.env.DISPLAY || /docker|lxc/.test(fs.readFileSync('/proc/1/cgroup', 'utf8')))) {
			return true;
		}
		if (process.platform === 'darwin' && process.env.SSH_TTY) {
			return true;
		}
	} catch (e) {
		// do nothing
	}

	return false;
}
