import loadConfig, { Config } from '../config.js';
import logger from '../logger.js';
import * as environments from '../environments.js';
import * as request from '../request.js';
import { axwayHome } from '../path.js';

import AmplifySDK from './amplify-sdk.js';
import Auth from './auth.js';
import Telemetry from './telemetry.js';

import Authenticator from './authenticators/authenticator.js';
import ClientSecret from './authenticators/client-secret.js';
import SignedJWT from './authenticators/signed-jwt.js';

import FileStore from './stores/file-store.js';
import MemoryStore from './stores/memory-store.js';
import SecureStore from './stores/secure-store.js';
import TokenStore from './stores/token-store.js';

const { warn } = logger('amplify-sdk:index');

export default AmplifySDK;

export {
	AmplifySDK,
	Auth,
	Telemetry,

	Authenticator,
	ClientSecret,
	SignedJWT,

	FileStore,
	MemoryStore,
	SecureStore,
	TokenStore
};

/**
 * Initialises a new Amplify SDK instance.
 *
 * @param {Object} [opts] - SDK options including `env` and auth options.
 * @param {Config} [config] - The Amplify await config. If not passed in, the config file is loaded.
 * @returns {Promise<AmplifySDK>} An initialized Amplify SDK instance.
 */
export async function initSDK(opts: any = {}, config?: Config) {
	if (!opts || typeof opts !== 'object') {
		throw new Error('Expected options to be an object');
	}

	if (!config) {
		config = await loadConfig();
	}

	const env = environments.resolve(opts.env || config.get('env'));

	interface AuthParams {
		baseUrl?: string;
		clientId: string;
		clientSecret?: string;
		homeDir: string;
		password?: string;
		persistSecrets?: boolean;
		platformUrl?: string;
		profile?: string;
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
		baseUrl: undefined,
		clientId: undefined,
		clientSecret: undefined,
		homeDir: axwayHome,
		password: undefined,
		persistSecrets: undefined,
		platformUrl: undefined,
		profile: config.profile,
		realm: env?.realm || 'Broker',
		secretFile: undefined,
		serverHost: undefined,
		serverPort: undefined,
		tokenRefreshThreshold: 15 * 60, // 15 minutes
		tokenStore: undefined,
		tokenStoreDir: axwayHome,
		tokenStoreType: undefined,
		username: undefined
	};

	for (const prop of Object.keys(props)) {
		params[prop] = opts[prop] !== undefined ? opts[prop] : config.get(`auth.${prop}`, props[prop]);
	}

	// default token store type to `auto`
	if (params.tokenStoreType === undefined) {
		params.tokenStoreType = 'auto';
		config.set('auth.tokenStoreType', 'auto');
		try {
			config.save();
		} catch (err) {
			warn(err);
		}
	}

	params.requestOptions = request.createRequestOptions(config);

	return new AmplifySDK(params);
}
