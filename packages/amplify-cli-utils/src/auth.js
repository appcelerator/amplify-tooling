/**
 * Attempts to get the access token based on the supplied credentials.
 *
 * @param {Object} [authOpts] - The account id or authentication options to override the config
 * values.
 * @param {String} [accountName] - The account name to find.
 * @returns {Promise}
 */
export async function getAccount(authOpts, accountName) {
	if (typeof authOpts === 'string') {
		accountName = authOpts;
		authOpts = {};
	}

	const Auth = require('@axway/amplify-auth-sdk').default;
	const loadConfig = require('./config').default;

	const config = loadConfig();
	const params = buildParams(authOpts, config);
	const client = new Auth(params);
	const account = await client.getAccount(accountName);

	return {
		account,
		client,
		config
	};
}

export default getAccount;

/**
 * Loads the amplify-auth-sdk package.
 *
 * @returns {Object}
 */
export function getAuth() {
	return require('@axway/amplify-auth-sdk').default;
}

/**
 * Returns a list of all valid access tokens.
 *
 * @param {Object} [authOpts] - Various authentication options.
 * @returns {Promise<Array>}
 */
export async function list(authOpts) {
	const Auth = require('@axway/amplify-auth-sdk').default;
	const loadConfig = require('./config').default;

	const config = loadConfig();
	const params = buildParams(authOpts, config);
	const client = new Auth(params);

	return await client.list();
}

/**
 * Constructs a parameters object to pass into an Auth instance.
 *
 * @param {Object} [opts] - User option overrides.
 * @param {Config} [config] - The AMPLIFY config object.
 * @returns {Object}
 */
export function buildParams(opts = {}, config) {
	if (opts && typeof opts !== 'object') {
		throw new Error('Expected options to be an object');
	}

	const loadConfig = require('./config').default;
	const { axwayHome } = require('./locations');
	const { environments } = require('./environments');

	if (!config) {
		config = loadConfig();
	}

	const env = opts.env || config.get('env') || 'prod';
	if (!environments.hasOwnProperty(env)) {
		throw new Error(`Invalid environment "${env}", expected ${Object.keys(environments).reduce((p, s, i, a) => `${p}"${s}"${i + 1 < a.length ? `, ${i + 2 === a.length ? 'or ' : ''}` : ''}`, '')}`);
	}

	const { clientId, realm } = environments[env].auth;
	const params = {};
	const props = {
		baseUrl:                 undefined,
		clientId,
		clientSecret:            undefined,
		env,
		interactiveLoginTimeout: undefined,
		password:                undefined,
		platformUrl:             undefined,
		realm,
		secretFile:              undefined,
		serverHost:              undefined,
		serverPort:              undefined,
		tokenRefreshThreshold:   undefined,
		tokenStore:              undefined,
		tokenStoreDir:           axwayHome,
		tokenStoreType:          undefined,
		username:                undefined
	};

	for (const prop of Object.keys(props)) {
		params[prop] = opts[prop] || config.get(`auth.${prop}`, props[prop]);
	}

	return params;
}
