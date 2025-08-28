import sourceMapSupport from 'source-map-support';
/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	sourceMapSupport.install();
}

import AmplifySDK, { Telemetry } from '@axway/amplify-sdk';
import boxen from 'boxen';
import check from 'check-kit';
import fs from 'fs';
import loadConfig, { Config } from '@axway/amplify-config';
import snooplogg from 'snooplogg';
import Table from 'cli-table3';
import { ansi } from 'cli-kit';
import { createNPMRequestArgs, createRequestClient, createRequestOptions } from './request.js';
import * as environments from './environments.js';
import * as locations from './locations.js';
import * as request from '@axway/amplify-request';
import * as telemetry from './telemetry.js';

export {
	AmplifySDK,
	Config,
	createNPMRequestArgs,
	createRequestClient,
	createRequestOptions,
	environments,
	loadConfig,
	locations,
	request,
	Telemetry,
	telemetry
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
export async function buildAuthParams(opts = {}, config) {
	if (!opts || typeof opts !== 'object') {
		throw new Error('Expected options to be an object');
	}

	if (!config) {
		config = await loadConfig();
	}

	const env = environments.resolve(opts.env || await config.get('env'));
	const region = opts.region || await config.get('region');

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
		persistSecrets:          undefined,
		platformUrl:             undefined,
		realm,
		region:                  region,
		secretFile:              undefined,
		serverHost:              undefined,
		serverPort:              undefined,
		serviceAccount:          undefined,
		tokenRefreshThreshold:   15 * 60, // 15 minutes
		tokenStore:              undefined,
		tokenStoreDir:           locations.axwayHome,
		tokenStoreType:          undefined,
		username:                undefined
	};

	for (const prop of Object.keys(props)) {
		params[prop] = opts[prop] !== undefined ? opts[prop] : await config.get(`auth.${prop}`, props[prop]);
	}

	// detect if we're headless and default token store type to `file`
	if (params.tokenStoreType === undefined && isHeadless()) {
		params.tokenStoreType = 'file';
		await config.set('auth.tokenStoreType', 'file');
		try {
			await config.save();
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
	opts = createRequestOptions(opts, config || await loadConfig());

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
 * Creates a table with default styles and padding.
 *
 * @param {Array.<String>} head - One or more headings.
 * @param {Number} [indent] - The number of spaces to indent the table.
 * @returns {Table}
 */
export function createTable(head, indent = 0) {
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
 * Resovles the "auth.*" config key based on your environment. This is used to get or set the
 * default account and org.
 *
 * @param {String} env - The resolved environment name.
 * @returns {String}
 *
 * @example
 *   await config.get(`${getAuthConfigEnvSpecifier(sdk.env.name)}.defaultAccount`);
 */
export function getAuthConfigEnvSpecifier(env) {
	return !env || env === 'prod' ? 'auth' : `auth.environment.${env}`;
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
 * Initializes the Amplify SDK, loads an account, and finds the default org id.
 *
 * @param {String} [accountName] - The name of the platform account to use.
 * @param {String} [org] - The name, id, or guid of the default organization.
 * @param {String} [env] - The environment name.
 * @param {boolean} [bypassPlatformAccountCheck] - Optional parameter to bypass check if the account is platform
 * @returns {Promise<Object>}
 */
export async function initPlatformAccount(accountName, org, env, bypassPlatformAccountCheck = false) {
	const { config, sdk } = await initSDK({ env });
	const authConfigEnvSpecifier = getAuthConfigEnvSpecifier(sdk.env.name);
	const account = await sdk.auth.find(accountName || await config.get(`${authConfigEnvSpecifier}.defaultAccount`));

	if (accountName) {
		if (!account) {
			throw new Error(`Account "${accountName}" not found`);
		} else if (!bypassPlatformAccountCheck && !account.isPlatform) {
			throw new Error(`Account "${accountName}" is not a platform account\n\nTo login, run: axway auth login`);
		}
	} else if (!account || (!bypassPlatformAccountCheck && !account.isPlatform)) {
		throw new Error('You must be logged into a platform account\n\nTo login, run: axway auth login');
	}

	if (org) {
		org = await sdk.org.find(account, org);
	} else {
		try {
			// check the config for a default org for this account
			org = await sdk.org.find(account, await config.get(`${authConfigEnvSpecifier}.defaultOrg.${account.hash}`));
		} catch (err) {
			// default org was stale, auto detect the default from the account orgs
			org = await sdk.org.find(account);
		}
	}

	return {
		account,
		config,
		org,
		sdk
	};
}

/**
 * Loads the config and creates an Amplify SDK object, then returns both of them.
 *
 * @param {Object} [opts] - SDK options including `env` and auth options.
 * @param {Object} [config] - The Amplify await config. If not passed in, the config file is loaded.
 * @returns {Object} Returns an object containing the Axway CLI config and an initialized
 * Amplify SDK instance.
 */
export async function initSDK(opts = {}, config) {
	if (!config) {
		config = await loadConfig();
	}
	return {
		config,
		sdk: new AmplifySDK(await buildAuthParams(opts, config))
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
