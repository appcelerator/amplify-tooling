import AmplifySDK from './amplify-sdk/index.js';
import loadConfig from './config.js';
import snooplogg from 'snooplogg';
import * as environments from './environments.js';
import * as request from './request.js';
import { axwayHome } from './path.js';

const { warn } = snooplogg('axway-cli');

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
 * TODO: Platform user auth is being removed with 5.0, so this should be renamed
 *
 * @param {String} [accountName] - The name of the platform account to use.
 * @param {String} [org] - The name, id, or guid of the default organization.
 * @param {String} [env] - The environment name.
 * @returns {Promise<Object>}
 */
export async function initPlatformAccount(accountName, org, env) {
	const { config, sdk } = await initSDK({ env });
	const authConfigEnvSpecifier = getAuthConfigEnvSpecifier(sdk.env.name);
	const account = await sdk.auth.find(accountName || await config.get(`${authConfigEnvSpecifier}.defaultAccount`));

	if (!account) {
		if (accountName) {
			throw new Error(`Account "${accountName}" not found`);
		}
		throw new Error('You must be authenticated\n\nTo login, run: axway auth login');
	}

	if (org) {
		org = await sdk.org.find(account, org);
	} else {
		try {
			// check the config for a default org for this account
			org = await sdk.org.find(account, await config.get(`${authConfigEnvSpecifier}.defaultOrg.${account.hash}`));
		} catch (_err) {
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
export async function initSDK(opts: any = {}, config?) {
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
		homeDir: string;
		password?: string;
		persistSecrets?: boolean;
		platformUrl?: string;
		realm: string;
		secretFile?: string;
		serverHost?: string;
		serverPort?: number;
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
		homeDir:                 axwayHome,
		password:                undefined,
		persistSecrets:          undefined,
		platformUrl:             undefined,
		realm,
		secretFile:              undefined,
		serverHost:              undefined,
		serverPort:              undefined,
		tokenRefreshThreshold:   15 * 60, // 15 minutes
		tokenStore:              undefined,
		tokenStoreDir:           axwayHome,
		tokenStoreType:          undefined,
		username:                undefined
	};

	for (const prop of Object.keys(props)) {
		params[prop] = opts[prop] !== undefined ? opts[prop] : await config.get(`auth.${prop}`, props[prop]);
	}

	// default token store type to `auto`
	if (params.tokenStoreType === undefined) {
		params.tokenStoreType = 'auto';
		await config.set('auth.tokenStoreType', 'auto');
		try {
			await config.save();
		} catch (err) {
			warn(err);
		}
	}

	params.requestOptions = request.createRequestOptions(opts, config);

	return {
		config,
		sdk: new AmplifySDK(params)
	};
}
