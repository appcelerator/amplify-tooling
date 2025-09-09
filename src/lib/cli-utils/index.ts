import sourceMapSupport from 'source-map-support';
/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	sourceMapSupport.install();
}

import AmplifySDK from '../amplify-sdk/index.js';
import fs from 'fs';
import loadConfig from '../config.js';
import snooplogg from 'snooplogg';
import * as environments from '../environments.js';
import * as request from '../request.js';
import { axwayHome } from '../path.js';

const { warn } = snooplogg('amplify-cli-utils');

/**
 * Constructs a parameters object to pass into an Auth instance.
 * TODO: This is only used to prime the amplify sdk in initSDK. Should this and that function consolidate into it?
 *
 * @param {Object} [opts] - User option overrides.
 * @param {Config} [config] - The Amplify config object.
 * @returns {Object}
 */
export async function buildAuthParams(opts: any = {}, config) {
	if (!opts || typeof opts !== 'object') {
		throw new Error('Expected options to be an object');
	}

	if (!config) {
		config = await loadConfig();
	}

	const env = environments.resolve(opts.env || await config.get('env'));

	const { clientId, realm } = env.auth;

	interface AuthParams {
		baseUrl?: string;
		clientId: string;
		clientSecret?: string;
		env: string;
		interactiveLoginTimeout?: number;
		homeDir: string;
		password?: string;
		persistSecrets?: boolean;
		platformUrl?: string;
		realm: string;
		secretFile?: string;
		serverHost?: string;
		serverPort?: number;
		serviceAccount?: string;
		tokenRefreshThreshold?: number;
		tokenStore?: string;
		tokenStoreDir: string;
		tokenStoreType?: string;
		username?: string;
		requestOptions?: any;
	}
	const params = {} as AuthParams;

	const props = {
		baseUrl:                 undefined,
		clientId,
		clientSecret:            undefined,
		env:                     env.name,
		interactiveLoginTimeout: undefined,
		homeDir:                 axwayHome,
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
		tokenStoreDir:           axwayHome,
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

	params.requestOptions = request.createRequestOptions(opts, config);

	return params;
}

/**
 * Resolves the "auth.*" config key based on your environment. This is used to get or set the
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
 * Initializes the Amplify SDK, loads an account, and finds the default org id.
 * TODO: Platform user auth is being removed with 5.0, so this should be able to be removed
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
export async function initSDK(opts = {}, config?) {
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
 * TODO: All use should be headless with 5.0 so this should be able to be removed
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
