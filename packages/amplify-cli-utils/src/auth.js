import snooplogg from 'snooplogg';

const logger = snooplogg('amplify-cli-utils:auth');

/**
 * Creates a new `Auth` instance. If `Auth` throws a secure store error, it change the error
 * message to indicate the command to reinstall the AMPLIFY CLI.
 *
 * @param {Object} params - Various auth parameters.
 * @returns {Auth}
 */
export function createAuth(params) {
	try {
		const Auth = require('@axway/amplify-auth-sdk').default;
		return new Auth(params);
	} catch (err) {
		// this secure store error was removed in amplify-auth-sdk@1.1.0, but remains here for
		// backwards compatiblity and will be removed in amplify-cli-utils@3.0.0
		if (err.code === 'ERR_SECURE_STORE_UNAVAILABLE') {
			const isWin = process.platform === 'win32';
			err.message = `Secure token store is not available.\nPlease reinstall the AMPLIFY CLI by running:\n    ${isWin ? '' : 'sudo '}npm install --global ${isWin ? '' : '--unsafe-perm '}@axway/amplify-cli`;
		}
		throw err;
	}
}

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
		authOpts = undefined;
	}

	const { log } = logger('getAccount');

	const { client, config } = initAuth(authOpts);
	let account;
	let accounts;

	if (authOpts) {
		// if we have authOpts, then we're authenticating, so let the client use the authenticator hash
		log('Auth opts set, getting account based on hash');
		account = await client.getAccount();
	} else {
		// no auth options, so we are safe to verify accounts and the default account
		log('No auth opts, getting all credentials');
		accounts = await client.list();
		if (!accounts.length) {
			const e = new Error('No credentials found, please login');
			e.code = 'ERR_NO_ACCOUNTS';
			throw e;
		}

		if (!accountName) {
			if (accounts.length === 1) {
				// if we only have 1 authenticated account, then just pick that
				accountName = accounts[0].hash;
			} else {
				const defaultAccount = config.get('auth.defaultAccount');
				accountName = undefined;

				// we have more than 1 credentialed account, so check if any of them are the default
				for (const acct of accounts) {
					if (acct.name === defaultAccount) {
						accountName = defaultAccount;
						break;
					}
				}
			}
		}

		if (accountName) {
			account = await client.getAccount(accountName);
			if (!account) {
				const e = new Error(`Unable to find account: ${accountName}`);
				e.code = 'ERR_ACCOUNT_NOT_FOUND';
				e.accounts = accounts;
				throw e;
			}
		}
	}

	return {
		account,
		accounts,
		client,
		config
	};
}

export default getAccount;

/**
 * Returns a list of all valid access tokens.
 *
 * @param {Object} [authOpts] - Various authentication options.
 * @returns {Promise<Array>}
 */
export async function list(authOpts) {
	const { client } = initAuth(authOpts);
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

	const loadConfig = require('@axway/amplify-config').default;
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
		homeDir:                 axwayHome,
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

/**
 * Boilerplate config loadinga and auth initialization.
 *
 * @param {Object} [authOpts] - Various authentication options.
 * @returns {Object}
 */
function initAuth(authOpts) {
	const loadConfig = require('@axway/amplify-config').default;

	const config = loadConfig();
	const params = buildParams(authOpts, config);
	const client = createAuth(params);

	return { client, config };
}
