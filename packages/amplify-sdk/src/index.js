/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Auth from '@axway/amplify-auth-sdk';
import setCookie from 'set-cookie-parser';
import got from 'got';
import snooplogg from 'snooplogg';

import * as environments from './environments';

const { log, warn } = snooplogg('amplify-sdk');
const { highlight, magenta, note } = snooplogg.styles;

/**
 * An SDK for accessing AMPLIFY API's.
 */
export class AmplifySDK {
	/**
	 * Initializes the environment and SDK's API.
	 *
	 * @param {Object} opts - Authentication options.
	 * @param {Object} [opts.env=prod] - The environment name.
	 * @access public
	 */
	constructor(opts) {
		/**
		 * Authentication options including baseURL, clientID, env, realm, and token store settings.
		 * @type {Object}
		 */
		this.opts = opts;

		/**
		 * Resolved environment-specific settings.
		 * @type {Object}
		 */
		this.env = environments.resolve(opts.env);

		/**
		 * The platform URL.
		 * @type {String}
		 */
		this.platformUrl = opts.platformUrl ? opts.platformUrl.replace(/\/$/, '') : null;

		this.auth = {
			/**
			 * Finds an authenticated account or `null` if not found. If the account is found and
			 * the access token is expired yet the refresh token is still valid, it will
			 * automatically get a valid access token.
			 * @param {String} accountName - The name of the account including the client id prefix.
			 * @returns {Promise<Object>} Resolves the account info object.
			 */
			find: async accountName => {
				const account = await this.client.find(accountName);
				return account ? await this.auth.loadSession(account) : null;
			},

			/**
			 * Returns a list of all authenticated accounts.
			 * @returns {Promise<Array>}
			 */
			list: () => this.client.list(),

			/**
			 * Populates the specified account info object with a dashboard session id and org
			 * information.
			 * @param {Object} account - The account object.
			 * @returns {Promise<Object>} Resolves the original account info object.
			 */
			loadSession: async account => {
				try {
					const result = await this.request('/api/v1/auth/findSession', account, {
						errorMsg: 'Failed to find session'
					});
					if (!result) {
						return account;
					}

					const { org, orgs, user } = result;

					account.org = {
						entitlements: Object
							.entries(org.entitlements || {})
							.reduce((obj, [ name, value ]) => {
								if (name[0] !== '_') {
									obj[name] = value;
								}
								return obj;
							}, {}),
						guid:         org.guid,
						id:           org.org_id,
						name:         org.name
					};

					log(`Current org: ${highlight(org.name)} ${note(`(${org.org_id})`)}`);
					account.orgs = orgs.map(({ guid, name, org_id }) => ({ guid, id: org_id, name }));

					log('Available orgs:');
					for (const org of account.orgs) {
						log(`  ${highlight(org.name)} ${note(`(${org.id})`)}`);
					}

					Object.assign(account.user, {
						axwayId:      user.axway_id,
						email:        user.email,
						firstName:    user.firstname,
						guid:         user.guid,
						lastName:     user.lastname,
						organization: user.organization
					});

					await this.client.updateAccount(account);

					return account;
				} catch (e) {
					throw new Error(`Failed to get session: ${e.message}`);
				}
			},

			/**
			 * Authenticates a user, retrieves the access tokens, populates the session id and
			 * org info, and returns it.
			 * @param {Object} opts - Various authentication options to override the defaults set
			 * via the constructor. See the AMPLIFY Auth SDK (@axway/amplify-auth-sdk) for more
			 * details.
			 * @returns {Promise<Object>} Resolves the account info object.
			 */
			login: async (opts = {}) => {
				let account;

				if (!opts?.force) {
					account = await this.client.find(opts);
					if (account && !account.auth.expired) {
						warn(`Account ${highlight(account.name)} is already authenticated`);
						const err = new Error('Account already authenticated');
						err.account = account;
						err.code = 'EAUTHENTICATED';
						throw err;
					}
				}

				account = await this.client.login(opts);
				return await this.auth.loadSession(account);
			},

			/**
			 * Discards an access token and notifies AxwayID to revoke the access token.
			 * @param {Object} opts - Various authentication options to override the defaults set
			 * via the constructor. See the AMPLIFY Auth SDK (@axway/amplify-auth-sdk) for more
			 * details.
			 * @param {Array.<String>|String} opts.accounts - A list of accounts names.
			 * @param {Boolean} opts.all - When `true`, revokes all accounts.
			 * @param {String} [opts.baseUrl] - The base URL used to filter accounts.
			 * @returns {Promise<Object>} Resolves a list of revoked credentials.
			 */
			logout: opts => this.client.logout(opts),

			/**
			 * Returns AxwayID server information.
			 * @param {Object} opts - Various authentication options to override the defaults set
			 * via the constructor. See the AMPLIFY Auth SDK (@axway/amplify-auth-sdk) for more
			 * details.
			 * @returns {Promise<object>}
			 */
			serverInfo: opts => this.client.serverInfo(opts),

			/**
			 * Switches your current organization.
			 * @param {Object} account - The account object. Note that this object reference will
			 * be updates with new org info.
			 * @param {String} orgId - The org id to switch to. Note this is NOT the org guid.
			 * @returns {Promise<Object>} Resolves the updated account object.
			 */
			switchOrg: async (account, orgId) => {
				if (!orgId || typeof orgId !== 'number') {
					throw new TypeError('Expected org id');
				}

				await this.request('/api/v1/auth/switchLoggedInOrg', account, {
					errorMsg: 'Failed to switch org',
					json: { org_id: orgId }
				});

				// refresh the account
				account = await this.auth.loadSession(account);

				// store the refreshed account
				await this.client.updateAccount(account);

				return account;
			}
		};

		const mbsUserHelper = async (account, groupId, env, opts) => {
			if (!groupId || typeof groupId !== 'string') {
				throw new TypeError('Expected group id to be a non-empty string');
			}
			if (!env || typeof env !== 'string') {
				throw new TypeError('Expected env to be a non-empty string');
			}
			const { response } = await this.request(`/api/v1/acs/${groupId}/${env}/data/user`, account, opts);
			return response.users;
		};

		this.mbs = {
			/**
			 * Creates a new MBS app for each MBS environment.
			 * @param {Object} account - The account object.
			 * @param {String} appGuid - The MBS app guid.
			 * @param {String} appName - The MBS name.
			 * @returns {Promise<Array>} Resolves the list of created apps.
			 */
			createApps: async (account, appGuid, appName) => {
				const { response } = await this.request('/api/v1/acs', account, {
					errorMsg: 'Failed to create MBS apps',
					json: {
						app_guid: appGuid,
						app_name: appName
					}
				});
				return response.apps;
			},

			/**
			 * Creates an MBS user.
			 * @param {Object} account - The account object.
			 * @param {String} groupId - The MBS app guid (i.e. group id).
			 * @param {String} env - The MBS environment (production, development, VPC name).
			 * @param {Object} userInfo - Detailed user information.
			 * @param {?} [userInfo.admin] - A admin flag of some sort.
			 * @param {?} [userInfo.custom_fields] - Custom fields of some sort.
			 * @param {String} [userInfo.email] - The user's email address.
			 * @param {String} [userInfo.first_name] - The user's first name.
			 * @param {String} [userInfo.last_name] - The user's last name.
			 * @param {String} userInfo.password - The user's password.
			 * @param {String} userInfo.password_confirmation - The password confirmation.
			 * @param {?} [userInfo.photo_id] - A photo id of some sort.
			 * @param {?} [userInfo.role] - The user's role.
			 * @param {?} [userInfo.tags] - Metadata of some sort.
			 * @param {String} [userInfo.username] - The user's username.
			 * @returns {Promise<Array>} Resolves the newly created user record including the `id`,
			 * `first_name`, `last_name`, `created_at`, `updated_at`, `external_accounts`,
			 * `confirmed_at`, `username`, `email`, `admin`, `stats`, and `friend_counts`.
			 */
			createUser: async (account, groupId, env, userInfo) => {
				if (!userInfo || typeof userInfo !== 'object') {
					throw new TypeError('Expected user info to be an object');
				}
				if (!userInfo.password || typeof userInfo.password !== 'string') {
					throw new TypeError('Expected user password to be a non-empty string');
				}
				if (!userInfo.password_confirmation || typeof userInfo.password_confirmation !== 'string') {
					throw new TypeError('Expected user password confirmation to be a non-empty string');
				}
				return (await mbsUserHelper(account, groupId, env, {
					errorMsg: 'Failed to create MBS user',
					json: userInfo
				}))[0];
			},

			/**
			 * Retrieves the list of environments associated to the user's org.
			 * @param {Object} account - The account object.
			 * @param {String} groupId - The MBS app guid (i.e. group id).
			 * @param {String} env - The MBS environment (production, development, VPC name).
			 * @returns {Promise<Array>}
			 */
			getUsers: async (account, groupId, env) => {
				return await mbsUserHelper(account, groupId, env, {
					errorMsg: 'Failed to get MBS user'
				});
			}
		};

		this.org = {
			/**
			 * Retrieves the list of environments associated to the user's org.
			 * @param {Object} account - The account object.
			 * @returns {Promise<Array>}
			 */
			getEnvironments: account => this.request('/api/v1/org/env', account, {
				errorMsg: 'Failed to get environments'
			})
		};

		this.ti = {
			/**
			 * Updates the app's build info in the platform.
			 * @param {Object} account - The account object.
			 * @param {Object} data - Post data.
			 * @param {String} data.buildId - The build id.
			 * @param {String} data.buildSHA - A SHA of all SHAs of encrypted .js files.
			 * @param {Object} data.keys - A map of filenames of the encrypted .js files and their
			 * respective keys.
			 * @returns {Promise}
			 */
			buildUpdate: async (account, data) => {
				if (!data || typeof data !== 'object') {
					throw new TypeError('Expected data to be an object');
				}
				if (!data.buildId || typeof data.buildId !== 'string') {
					throw new TypeError('Expected build id to be a string');
				}
				if (!data.buildSHA || typeof data.buildSHA !== 'string') {
					throw new TypeError('Expected build SHA to be a string');
				}
				if (!data.keys || typeof data.keys !== 'object') {
					throw new TypeError('Expected keys to be an object');
				}

				await this.request('/api/v1/auth/build-update', account, {
					errorMsg: 'Failed to update build info',
					json: {
						buildid:  data.buildId,
						buildsha: data.buildSHA,
						keys:     { ...data.keys }
					}
				});
			},

			/**
			 * Verifies the app is registered and the user has rights to build the app and use the
			 * modules.
			 * @param {Object} account - The account object.
			 * @param {Object} data - Post data.
			 * @param {String} data.appGuid - The application guid.
			 * @param {String} data.appId - The application id.
			 * @param {String} data.deployType - The deploy type (production, test, development).
			 * @param {String} data.fingerprint - The machine's fingerprint.
			 * @param {String} [data.modules] - An array of modules from the `tiapp.xml`.
			 * @param {String} data.name - The name of the application.
			 * @param {String} data.tiapp - The contents of the `tiapp.xml`.
			 * @returns {Promise<Object>} Resolves the verification info.
			 */
			buildVerify: async (account, data) => {
				if (!data || typeof data !== 'object') {
					throw new TypeError('Expected data to be an object');
				}
				for (const key of [ 'appGuid', 'appId', 'deployType', 'fingerprint', 'name', 'tiapp' ]) {
					if (!data[key] || typeof data[key] !== 'string') {
						throw new TypeError(`Expected ${key.replace(/[A-Z]/g, s => ` ${s.toLowerCase()}`)} to be a non-empty string`);
					}
				}
				if (data.modules) {
					if (!Array.isArray(data.modules) || data.modules.some(m => !m || typeof m !== 'object')) {
						throw new TypeError('Expected modules to be an array of objects');
					}
					data.modules = data.modules.map(m => {
						const obj = { ...m };
						delete obj.bindings;
						return obj;
					});
				}

				try {
					return await this.request('/api/v1/auth/build-verify', account, {
						errorMsg: 'Failed to verify build',
						json: {
							appid:                   data.appId,
							deploytype:              data.deployType,
							fingerprint:             data.fingerprint,
							fingerprint_description: '',
							guid:                    data.appGuid,
							ipaddress:               '',
							modules:                 data.modules,
							name:                    data.name,
							org_id:                  account.org.id,
							tiappxml:                data.tiapp
						}
					});
				} catch (err) {
					// strip off the irrelevant message saying to logout via the old Appc CLI
					err.message = err.message.replace(/\s*Please logout.*$/i, '');
					throw err;
				}
			},

			/**
			 * Generates a developer certificate.
			 * @param {Object} account - The account object.
			 * @param {Object} data - Various post data.
			 * @param {String} data.description - The description to use for the cert.
			 * @param {String} data.fingerprint - The machine's fingerprint.
			 * @param {String} data.publicKey - Public key to use for the cert.
			 * @returns {Promise<Object>} Resolves the server generated developer certificate.
			 */
			enroll: async (account, data) => {
				if (!data || typeof data !== 'object') {
					throw new TypeError('Expected data to be an object');
				}
				for (const key of [ 'description', 'fingerprint', 'publicKey' ]) {
					if (!data[key] || typeof data[key] !== 'string') {
						throw new TypeError(`Expected ${key.replace(/[A-Z]/g, s => ` ${s.toLowerCase()}`)} to be a non-empty string`);
					}
				}
				return await this.request('/api/v1/auth/dev-enroll', account, {
					errorMsg: 'Failed to enroll developer',
					json: data,
					resultKey: 'certificate'
				});
			},

			/**
			 * Retrieves the URL to upload symbols for crash analytics.
			 * @param {Object} account - The account object.
			 * @param {Object} appGuid - The Titanium application guid.
			 * @returns {Promise<Object>} Resolves an object containing the `url`, `api_token`,
			 * `limit`, and `module`.
			 */
			getACAUploadURL: async (account, appGuid) => {
				if (!appGuid || typeof appGuid !== 'string') {
					throw new TypeError('Expected app guid');
				}
				return await this.request(`/api/v1/app/${appGuid}/upload`, account, {
					errorMsg: 'Failed to get ACA upload URL'
				});
			},

			/**
			 * Gets info about a Titanium app.
			 * @param {Object} account - The account object.
			 * @param {String} appGuid - The application guid.
			 * @returns {Promise<Object>} Resolves the app info.
			 */
			getApp: async (account, appGuid) => {
				if (!appGuid || typeof appGuid !== 'string') {
					throw new TypeError('Expected app guid');
				}
				return await this.request(`/api/v1/app/${appGuid}`, account, {
					errorMsg: 'Failed to get app info'
				});
			},

			/**
			 * Constructs the app verify URL that gets embedded in a Titanium app.
			 * @returns {String}
			 */
			getAppVerifyURL: () => `${this.env.platformUrl}/api/v1/app/verify`,

			/**
			 * Returns the list of Titanium modules.
			 * @param {Object} account - The account object.
			 * @returns {Promise<Array>} Resolves the list of modules.
			 */
			getDownloads: async account => await this.request('/api/v1/downloads', account, {
				errorMsg: 'Failed to get downloads'
			}),

			/**
			 * Updates or registers a Titanium app with the platform by uploading a `tiapp.xml`.
			 * The tiapp must contain a `<name>`, `<id>`, and a `<guid>`.
			 * @param {Object} account - The account object.
			 * @param {String} tiapp - The contents of the `tiapp.xml`.
			 * @returns {Promise<Object>} Resolves the app info.
			 */
			setApp: async (account, tiapp) => {
				if (!tiapp || typeof tiapp !== 'string') {
					throw new TypeError('Expected tiapp to be a non-empty string');
				}
				return await this.request('/api/v1/app/saveFromTiApp', account, {
					errorMsg: 'Failed to update/register app',
					json: { tiapp }
				});
			}
		};
	}

	/**
	 * Returns an AMPLIFY Auth SDK client or creates one if it doesn't exist.
	 * @type {Auth}
	 * @access public
	 */
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

	/**
	 * Makes an HTTP request.
	 * @param {String} path - The path to append to the URL.
	 * @param {Object} account - The account object.
	 * @param {Object} [opts] - Various options.
	 * @param {String} [opts.resultKey='result'] - The name of the property return from the response.
	 * @param {Object} [opts.json] - A JSON payload to send.
	 * @param {String} [opts.method] - The HTTP method to use. If not set, then uses `post` if
	 * `opts.json` is set, otherwise `get`.
	 * @returns {Promise} Resolves the JSON-parsed result.
	 * @access private
	 */
	async request(path, account, { errorMsg, json, method, resultKey = 'result' } = {}) {
		try {
			if (!account || typeof account !== 'object') {
				throw new Error('Account required');
			}

			const { sid } = account;
			const token = account.auth?.tokens?.access_token;
			if (!sid && !token) {
				throw new Error('Invalid/expired account');
			}

			const url = `${this.platformUrl || this.env.platformUrl}${path}`;
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
			// log(headers);
			// if (json) {
			// 	log(json);
			// }
			const response = await got[method](url, {
				headers,
				json,
				responseType: 'json',
				retry: 0
			});

			const cookies = response.headers['set-cookie'];
			const connectSid = cookies && setCookie.parse(cookies).find(c => c.name === 'connect.sid')?.value;
			if (connectSid) {
				log(`Setting sid: ${highlight(connectSid)}`);
				account.sid = connectSid;
				await this.client.updateAccount(account);
			}

			return response.body?.[resultKey];
		} catch (err) {
			const msg = err.response?.body?.message || err.response?.body?.description;
			err.message = `${errorMsg ? `${errorMsg}: ` : ''}${msg || err.message}`;

			const code = err.response?.body?.code;
			if (code) {
				err.code = code;
			}

			throw err;
		}
	}
}

export default AmplifySDK;
