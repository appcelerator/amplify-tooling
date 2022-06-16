import AmplifySDK, { AmplifySDKOptions, Telemetry } from '@axway/amplify-sdk';
import fs from 'fs';
import loadConfig, { Config } from '@axway/amplify-config';
import Table from 'cli-table3';
import snooplogg from 'snooplogg';
import { ansi } from 'cli-kit';
import { BuildAuthParamsOptions, InitPlatformAccountResult } from './types.js';
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
const { green } = snooplogg.chalk;

/**
 * Constructs a parameters object to pass into an Auth instance.
 *
 * @param {Object} [opts] - User option overrides.
 * @param {Config} [config] - The Amplify config object.
 * @returns {Object}
 */
export async function buildAuthParams(opts: BuildAuthParamsOptions = {}, config?: Config): Promise<AmplifySDKOptions> {
	if (!opts || typeof opts !== 'object') {
		throw new Error('Expected options to be an object');
	}

	if (!config) {
		config = await loadConfig();
	}

	const env = environments.resolve(opts.env || config.get('env'));

	const { clientId, realm } = env.auth;
	const params: AmplifySDKOptions = {};
	const props: BuildAuthParamsOptions = {
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
		params[prop as keyof AmplifySDKOptions] = opts[prop as keyof BuildAuthParamsOptions] !== undefined
			? opts[prop as keyof BuildAuthParamsOptions]
			: config.get(`auth.${prop}`, props[prop as keyof BuildAuthParamsOptions]);
	}

	// detect if we're headless and default token store type to `file`
	if (params.tokenStoreType === undefined && isHeadless()) {
		params.tokenStoreType = 'file';
		config.set('auth.tokenStoreType', 'file');
		try {
			config.save();
		} catch (err: any) {
			warn(err);
		}
	}

	params.requestOptions = await createRequestOptions(opts.requestOptions, config);

	return params;
}

// `buildParams()` is too ambiguous, so it was renamed to `buildAuthParams()`, but we still need to
// maintain backwards compatibility
export { buildAuthParams as buildParams };

/**
 * Creates a table with default styles and padding.
 *
 * @param {Array.<String>} head - One or more headings.
 * @param {Number} [indent] - The number of spaces to indent the table.
 * @returns {Table}
 */
export function createTable(head: string[], indent = 0) {
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
 *   config.get(`${getAuthConfigEnvSpecifier(sdk.env.name)}.defaultAccount`);
 */
export function getAuthConfigEnvSpecifier(env: string): string {
	return !env || env === 'prod' ? 'auth' : `auth.environment.${env}`;
}

/**
 * Highlights the difference between two versions.
 *
 * @param {String} toVer - The latest version.
 * @param {String} fromVer - The current version.
 * @returns {String}
 */
export function hlVer(toVer: string, fromVer: string): string {
	const version = [];

	const [ from, fromTag ] = fromVer.split(/-(.+)/);
	const fromArr = from.replace(/[^.\d]/g, '').split('.').map(x => parseInt(x));

	const [ to, toTag ] = toVer.split(/-(.+)/);
	const toMatch = to.match(/^([^\d]+)?(.+)$/);
	const toArr = (toMatch ? toMatch[2] : to).split('.').map(x => parseInt(x));

	const tag = (): string => {
		if (toTag) {
			const toNum = toTag.match(/\d+$/);
			const fromNum = fromTag && fromTag.match(/\d+$/);
			if (fromNum && toNum && parseInt(fromNum[0]) >= parseInt(toNum[0])) {
				return `-${toTag}`;
			} else {
				return green(`-${toTag}`);
			}
		}
		return '';
	};

	while (toArr.length) {
		if (toArr[0] > fromArr[0]) {
			if (version.length) {
				return (toMatch && toMatch[1] || '') + [ ...version, green(toArr.join('.') + tag()) ].join('.');
			}
			return green((toMatch && toMatch[1] || '') + toArr.join('.') + tag());
		}
		version.push(toArr.shift());
		fromArr.shift();
	}

	return (toMatch && toMatch[1] || '') + version.join('.') + tag();
}

/**
 * Initializes the Amplify SDK, loads an account, and finds the default org id.
 *
 * @param {String} [accountName] - The name of the platform account to use.
 * @param {String} [org] - The name, id, or guid of the default organization.
 * @param {String} [env] - The environment name.
 * @returns {Promise<Object>}
 */
export async function initPlatformAccount(accountName?: string, org?: string, env?: string): Promise<InitPlatformAccountResult> {
	const { config, sdk } = await initSDK({ env });
	const authConfigEnvSpecifier = getAuthConfigEnvSpecifier(sdk.env.name);
	const account = await sdk.auth.find(accountName || config.get(`${authConfigEnvSpecifier}.defaultAccount`));

	if (accountName) {
		if (!account) {
			throw new Error(`Account "${accountName}" not found`);
		} else if (!account.isPlatform) {
			throw new Error(`Account "${accountName}" is not a platform account\n\nTo login, run: axway auth login`);
		}
	} else if (!account || !account.isPlatform) {
		throw new Error('You must be logged into a platform account\n\nTo login, run: axway auth login');
	}

	let orgObj = null;
	if (org) {
		orgObj = await sdk.org.find(account, org);
	} else {
		try {
			// check the config for a default org for this account
			orgObj = await sdk.org.find(account, config.get(`${authConfigEnvSpecifier}.defaultOrg.${account.hash}`));
		} catch (err: any) {
			// default org was stale, auto detect the default from the account orgs
			orgObj = await sdk.org.find(account);
		}
	}

	return {
		account,
		config,
		org: orgObj,
		sdk
	};
}

/**
 * Loads the config and creates an Amplify SDK object, then returns both of them.
 *
 * @param {Object} [opts] - SDK options including `env` and auth options.
 * @param {Object} [config] - The Amplify config. If not passed in, the config file is loaded.
 * @returns {Object} Returns an object containing the Axway CLI config and an initialized
 * Amplify SDK instance.
 */
export async function initSDK(opts: BuildAuthParamsOptions = {}, config?: Config): Promise<{ config: Config, sdk: AmplifySDK }> {
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
export function isHeadless(): boolean {
	try {
		if (process.platform === 'linux' && (process.env.SSH_TTY || !process.env.DISPLAY || /docker|lxc/.test(fs.readFileSync('/proc/1/cgroup', 'utf8')))) {
			return true;
		}
		if (process.platform === 'darwin' && process.env.SSH_TTY) {
			return true;
		}
	} catch (e: any) {
		// do nothing
	}

	return false;
}
