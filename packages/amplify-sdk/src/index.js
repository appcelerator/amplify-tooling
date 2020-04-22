/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Auth from '@axway/amplify-auth-sdk';
import setCookie from 'set-cookie-parser';
import got from 'got';
import snooplogg from 'snooplogg';

import * as environments from './environments';

const { log } = snooplogg('amplify-sdk');
const { highlight, magenta, note } = snooplogg.styles;

export class AmplifySDK {
	constructor(opts) {
		this.opts = opts;
		this.env = environments.resolve(opts.env);

		this.aca = {
			getUploadURL: async (account, appGuid) => {
				if (!appGuid || typeof appGuid !== 'string') {
					throw new TypeError('Expected app guid');
				}
				return await this.request(`/api/v1/app/${appGuid}/upload`, account);
			}
		};

		this.auth = {
			find: async accountName => {
				const account = await this.client.find(accountName);
				return account ? await this.auth.loadSession(account) : null;
			},
			list: () => this.client.list(),
			loadSession: async account => {
				const { org, orgs, user } = await this.request('/api/v1/auth/findSession', account);

				account.org = {
					guid: org.guid,
					id:   org.org_id,
					name: org.name
				};

				log(`Current org: ${highlight(org.name)} ${note(`(${org.org_id})`)}`);
				account.orgs = orgs.map(({ guid, name, org_id }) => ({ guid, name, org_id }));

				log('Available orgs:');
				for (const org of account.orgs) {
					log(`  ${highlight(org.name)} ${note(`(${org.org_id})`)}`);
				}

				Object.assign(account.user, {
					axwayId:      user.axway_id,
					email:        user.email,
					firstname:    user.firstname,
					guid:         user.guid,
					is2FAEnabled: !user.disable_2fa,
					lastname:     user.lastname,
					organization: user.organization
				});

				await this.client.updateAccount(account);

				return account;
			},
			login: async opts => {
				const account = await this.client.login(opts);
				return await this.auth.loadSession(account);
			},
			logout: opts => this.client.logout(opts),
			serverInfo: () => this.client.serverInfo(),
			switchOrg: async (account, orgId) => {
				if (!orgId || typeof orgId !== 'number') {
					throw new TypeError('Expected org id');
				}

				const { guid, org_id, org_name: name } = await this.request('/api/v1/auth/switchLoggedInOrg', account, {
					json: { org_id: orgId }
				});
				account.org = { guid, name, org_id };
				await this.client.updateAccount(account);

				return account;
			}
		};

		const mbsUserHelper = async (account, env, groupId, user) => {
			if (!env || typeof env !== 'string') {
				throw new TypeError('Expected env to be a non-empty string');
			}
			if (!groupId || typeof groupId !== 'string') {
				throw new TypeError('Expected group id to be a non-empty string');
			}

			let opts = json && { json: user };
			const { response } = await this.request(`/api/v1/acs/${groupId}/${env}/data/user`, account, opts);
			return response.users;
		};

		this.mbs = {
			createApps: async (account, appGuid, appName) => {
				const { response } = await this.request('/api/v1/acs', account, {
					json: {
						app_guid: appGuid,
						app_name: appName
					}
				});
				return response.apps;
			},
			createUser: async (account, env, groupId, user) => {
				if (!user || typeof user !== 'object') {
					throw new TypeError('Expected user to be an object');
				}
				if (!user.password || typeof user.password !== 'string') {
					throw new TypeError('Expected user password to be a non-empty string');
				}
				if (!user.password_confirmation || typeof user.password_confirmation !== 'string') {
					throw new TypeError('Expected user password confirmation to be a non-empty string');
				}
				return await mbsUserHelper(account, env, groupId, user);
			},
			getUsers: async (account, env, groupId) => {
				return await mbsUserHelper(account, env, groupId);
			}
		};

		this.org = {
			getEnvironments: account => this.request('/api/v1/org/env', account)
		};

		this.ti = {
			/**
			 * Gets the app info.
			 * @param {Object} account - The account object.
			 * @param {String} appGuid - The application guid.
			 * @returns {Promise<Object>} Resolves the app info.
			 */
			getApp: async (account, appGuid) => {
				if (!appGuid || typeof appGuid !== 'string') {
					throw new TypeError('Expected app guid');
				}
				return await this.request(`/api/v1/app/${appGuid}`, account);
			},
			getAppVerifyURL: () => `${this.env.platformUrl}/api/v1/app/verify`,
			buildVerify: async () => null,
			buildUpdate: async () => null,
			getDownloads: async account => await this.request('/api/v1/downloads', account),

			/**
			 * Generates the developer certificate.
			 * @param {Object} account - The account object.
			 * @param {Object} data - Various post data.
			 * @param {String} [data.description] - The description to use for the cert.
			 * @param {String} [data.fingerprint] - The machine's fingerprint.
			 * @param {String} data.publicKey - Public key to use for the cert.
			 * @returns {Promise<Object>} Resolves the requested certificate.
			 */
			enroll: async (account, data) => {
				if (!data || typeof data !== 'object') {
					throw new TypeError('Expected data to be an object');
				}
				if (data.description || typeof data.description !== 'string') {
					throw new TypeError('Expected description to be a string');
				}
				if (data.fingerprint && typeof data.fingerprint !== 'string') {
					throw new TypeError('Expected fingerprint to be a string');
				}
				if (!data.publicKey || typeof data.publicKey !== 'string') {
					throw new TypeError('Expected public key to be a non-empty string');
				}
				return await this.request('/api/v1/auth/dev-enroll', account, { json: data, resultKey: 'certificate' });
			},

			register: async () => null, // import

			/**
			 * Save the tiapp.xml. The tiapp must contain a `name`, `id`, and a `guid`.
			 *
			 * @type {Object} account - The account object.
			 * @returns {Promise<Object>} Resolves the app info.
			 */
			setApp: async (account, tiapp) => {
				if (!tiapp || typeof tiapp !== 'string') {
					throw new TypeError('Expected tiapp to be a non-empty string');
				}
				return await this.request('/api/v1/app/saveFromTiApp', account, { json: { tiapp } });
			}
		};
	}

	get client() {
		try {
			if (!this._client) {
				this._client = new Auth(this.opts);
			}
			return this._client;
		} catch (err) {
			if (err.code === 'ERR_SECURE_STORE_UNAVAILABLE') {
				const isWin = process.platform === 'win32';
				err.message = `Secure token store is not available.\nPlease reinstall the AMPLIFY CLI by running:\n    ${isWin ? '' : 'sudo '}npm install --global ${isWin ? '' : '--unsafe-perm '}@axway/amplify-cli`;
			}
			throw err;
		}
	}

	async request(path, account, { resultKey = 'result', json, method } = {}) {
		if (!account || typeof account !== 'object') {
			throw new Error('Account required');
		}

		const { sid } = account;
		const token = account.auth?.tokens?.access_token;
		if (!sid && !token) {
			throw new Error('Invalid/expired account');
		}

		const url = `${this.env.platformUrl}${path}`;
		const headers = {
			Accept: 'application/json'
		};

		if (account.sid) {
			headers.Cookie = `connect.sid=${account.sid}`;
		} else {
			headers.Authorization = `Bearer ${token}`;
		}

		if (!method) {
			method = json ? 'post' : 'get';
		}

		log(`Requesting ${magenta(method)} ${highlight(url)} ${note(`(${account.sid ? `sid ${account.sid}` : `token ${token}`})`)}`);
		const response = await got[method](url, {
			headers,
			json,
			responseType: 'json'
		});

		const cookies = response.headers['set-cookie'];
		const connectSid = cookies && setCookie.parse(cookies).find(c => c.name === 'connect.sid')?.value;
		if (connectSid) {
			log(`Setting sid: ${highlight(connectSid)}`);
			account.sid = connectSid;
			await this.client.updateAccount(account);
		}

		return response.body[resultKey];
	}
}

export default AmplifySDK;
