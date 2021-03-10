import Auth from './auth';
import E from './errors';
import fs from 'fs-extra';
import getEndpoints from './endpoints';
import open from 'open';
import path from 'path';
import querystring from 'querystring';
import Server from './server';
import setCookie from 'set-cookie-parser';
import snooplogg from 'snooplogg';
import * as environments from './environments';
import * as request from '@axway/amplify-request';
import { createURL } from './util';

const { log, warn } = snooplogg('amplify-sdk');
const { highlight, note } = snooplogg.styles;

/**
 * An SDK for accessing AMPLIFY API's.
 */
export default class AmplifySDK {
	/**
	 * Initializes the environment and SDK's API.
	 *
	 * @param {Object} opts - Authentication options.
	 * @param {Object} [opts.env=prod] - The environment name.
	 * @param {Object} [opts.requestOptions] - An options object to pass into AMPLIFY CLI Utils to
	 * create the `got` HTTP client.
	 * @access public
	 */
	constructor(opts = {}) {
		if (typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

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

		// set the defaults based on the environment
		for (const prop of [ 'baseUrl', 'platformUrl', 'realm' ]) {
			if (!opts[prop]) {
				opts[prop] = this.env[prop];
			}
		}

		/**
		 * The `got` HTTP client.
		 * @type {Function}
		 */
		this.got = request.init(opts.requestOptions);

		/**
		 * The base Axway ID URL.
		 * @type {String}
		 */
		this.baseUrl = opts.baseUrl ? opts.baseUrl.replace(/\/$/, '') : null;

		/**
		 * The platform URL.
		 * @type {String}
		 */
		this.platformUrl = opts.platformUrl ? opts.platformUrl.replace(/\/$/, '') : null;

		/**
		 * The Axway ID realm.
		 * @type {String}
		 */
		this.realm = opts.realm;

		const { version } = fs.readJsonSync(path.resolve(__dirname, '../package.json'));

		/**
		 * The Axway ID realm.
		 * @type {String}
		 */
		this.userAgent = `AMPLIFY SDK/${version} (${process.platform}; ${process.arch}; node:${process.versions.node})${process.env.AXWAY_CLI ? ` Axway CLI/${process.env.AXWAY_CLI}` : ''}`;

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
			 * Retrieves platform session information such as the organizations, then mutates the
			 * account object and returns it.
			 * @param {Object} account - The account object.
			 * @returns {Promise<Object>} Resolves the original account info object.
			 */
			findSession: async account => {
				const result = await this.request('/api/v1/auth/findSession', account, { errorMsg: 'Failed to find session' });
				account.isPlatform = !!result;

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
					name:         org.name,
					region:       org.region
				};

				account.orgs = orgs.map(({ guid, name, org_id }) => ({
					default: org_id === org.org_id,
					guid,
					id: org_id,
					name
				}));

				Object.assign(account.user, {
					axwayId:      user.axway_id,
					dateJoined:   user.date_activated,
					email:        user.email,
					firstname:    user.firstname,
					guid:         user.guid,
					lastname:     user.lastname,
					organization: user.organization,
					phone:        user.phone
				});

				return account;
			},

			/**
			 * Returns a list of all authenticated accounts.
			 * @returns {Promise<Array>}
			 */
			list: async () => {
				const accounts = await this.client.list();
				return accounts.sort((a, b) => a.name.localeCompare(b.name));
			},

			/**
			 * Populates the specified account info object with a dashboard session id and org
			 * information.
			 * @param {Object} account - The account object.
			 * @returns {Promise<Object>} Resolves the original account info object.
			 */
			loadSession: async account => {
				account = await this.auth.findSession(account);
				await this.client.updateAccount(account);

				log(`Current org: ${highlight(account.org.name)} ${note(`(${account.org.guid})`)}`);
				log('Available orgs:');
				for (const org of account.orgs) {
					log(`  ${highlight(org.name)} ${note(`(${org.guid})`)}`);
				}

				return account;
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
						try {
							err.account = await this.auth.loadSession(account);
						} catch (e) {
							warn(e);
						}
						err.code = 'EAUTHENTICATED';
						throw err;
					}
				}

				account = await this.client.login(opts);

				if (opts.manual) {
					// account is actually an object containing `cancel`, `promise`, and `url`
					return account;
				}

				return await this.auth.loadSession(account);
			},

			/**
			 * Discards an access token and notifies AxwayID to revoke the access token.
			 * @param {Object} opts - Various authentication options to override the defaults set
			 * via the constructor. See the AMPLIFY Auth SDK (@axway/amplify-auth-sdk) for more
			 * details.
			 * @param {Array.<String>} opts.accounts - A list of accounts names.
			 * @param {Boolean} opts.all - When `true`, revokes all accounts.
			 * @param {String} [opts.baseUrl] - The base URL used to filter accounts.
			 * @returns {Promise<Object>} Resolves a list of revoked credentials.
			 */
			logout: async ({ accounts, all, baseUrl = this.baseUrl } = {}) => {
				if (all) {
					accounts = await this.client.list();
				} else {
					if (!Array.isArray(accounts)) {
						throw E.INVALID_ARGUMENT('Expected accounts to be a list of accounts');
					}
					if (!accounts.length) {
						return [];
					}
					accounts = (await this.client.list()).filter(account => accounts.includes(account.name));
				}

				for (const account of accounts) {
					if (account.isPlatform) {
						// note: there should only be 1 platform account in the accounts list
						const { logout } = getEndpoints({ baseUrl: this.baseUrl, realm: this.realm });
						const redirect = `${logout}?redirect_uri=${this.platformUrl}/signed.out?msg=signin`;
						const url = `${this.platformUrl}/api/v1/auth/logout?redirect=${encodeURIComponent(redirect)}`;
						log(`Launching default web browser: ${highlight(url)}`);
						await open(url);
					}
				}

				return await this.client.logout({ accounts: accounts.map(account => account.name), baseUrl });
			},

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
			 * @param {Object} [account] - The account object. Note that this object reference will
			 * be updated with new org info.
			 * @param {String} [orgId] - The org id to switch to. Note this is NOT the org guid.
			 * @returns {Promise<Object>} Resolves the updated account object.
			 */
			switchOrg: async (account, orgId) => {
				if (!account || account.auth.expired) {
					log(`${account ? 'Account is expired' : 'No account specified'}, doing login`);
					account = await this.client.login();
				} else {
					const server = new Server();
					const { start, url: redirect } = await server.createCallback((req, res) => {
						res.writeHead(302, {
							Location: this.opts.platformUrl
						});
						res.end();
					});

					try {
						try {
							const url = createURL(`${this.opts.platformUrl}/#/auth/org.select`, {
								org_id: orgId,
								redirect
							});
							log(`Launching default web browser: ${highlight(url)}`);
							await open(url);
						} catch (err) {
							const m = err.message.match(/Exited with code (\d+)/i);
							throw m ? new Error(`Failed to open web browser (code ${m[1]})`) : err;
						}

						log(`Waiting for browser to be redirected to: ${highlight(redirect)}`);
						await start();
					} finally {
						await server.stop();
					}
				}

				try {
					// refresh the account
					if (account.sid) {
						log(`Deleting sid ${account.sid}`);
						delete account.sid;
					}
					return await this.auth.loadSession(account);
				} catch (e) {
					// squelch
					log(e);
				}

				throw new Error('Failed to switch organization');
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
			 * Retrieves organization details for an account.
			 * @param {Object} account - The account object.
			 * @param {String} org - The name, id, or guid of the organization to get info for.
			 * @returns {Promise<Array>}
			 */
			get: async (account, org) => {
				if (!account || typeof account !== 'object') {
					throw E.INVALID_ACCOUNT('Account required');
				}

				if (!account.isPlatform) {
					throw E.INVALID_PLATFORM_ACCOUNT('Account must be a platform account');
				}

				const found = account.orgs.find(o => {
					return o.guid.toLowerCase() === String(org).toLowerCase()
						|| o.id === ~~org
						|| o.name.toLowerCase() === String(org).toLowerCase();
				});

				if (!found) {
					throw new Error(`Unable to find an organization "${org}"`);
				}
				const { id } = found;

				org = await this.request(`/api/v1/org/${id}`, account, {
					errorMsg: 'Failed to get organization'
				});

				const subscriptions = org.subscriptions.map(s => ({
					category:   s.product,  // TODO: Replace with annotated name
					edition:    s.plan,     // TODO: Replace with annotated name
					expired:    !!s.expired,
					governance: s.governance || 'SaaS',
					startDate:  s.start_date,
					endDate:    s.end_date,
					tier:       s.tier
				}));

				const result = {
					active:           org.active,
					created:          org.created,
					childOrgs:        null,
					guid:             org.guid,
					id:               id,
					name:             org.name,
					parentOrg:        null,
					region:           org.region,
					insightUserCount: ~~org.entitlements.limit_read_only_users,
					seats:            org.entitlements.limit_users === 10000 ? null : org.entitlements.limit_users,
					subscriptions,
					teamCount:        (await this.org.getTeams(account, id)).length,
					userCount:        org.users.length
				};

				if (org.parent_org_guid) {
					// get the parent org info
					const parent = await this.request(`/api/v1/org/${org.parent_org_guid}`, account, {
						errorMsg: 'Failed to get organization'
					});
					result.parentOrg = {
						guid: parent.guid,
						id:   parent.org_id,
						name: parent.name
					};
				} else {
					// check for children
					const { children } = await this.org.getFamily(account, id);
					result.childOrgs = children.map(o => ({
						active:    o.active,
						created:   o.created,
						guid:      o.guid,
						id:        o.id,
						name:      o.name,
						userCount: o.users.length
					}));
				}

				return result;
			},

			/**
			 * Retrieves the list of environments associated to the user's org.
			 * @param {Object} account - The account object.
			 * @returns {Promise<Array>}
			 */
			getEnvironments: account => this.request('/api/v1/org/env', account, {
				errorMsg: 'Failed to get organization environments'
			}),

			getFamily: (account, orgId) => this.request(`/api/v1/org/${orgId}/family`, account, {
				errorMsg: 'Failed to get organization family'
			}),

			getMembers: async (account, orgId) => {
				// TODO
				return [];
			},

			getTeams: (account, orgId) => this.request(`/api/v1/team?org_id=${orgId}`, account, {
				errorMsg: 'Failed to get organization teams'
			}),

			/**
			 * Retrieves the list of orgs from the specified account.
			 * @param {Object} account - The account object.
			 * @param {String} defaultOrg - The name, id, or guid of the default organization.
			 * @returns {Promise<Array>}
			 */
			list: async (account, defaultOrg) => {
				if (!account || typeof account !== 'object') {
					throw new TypeError('Account required');
				}

				if (defaultOrg === undefined) {
					return account.orgs;
				}

				// if we have a defaultOrg, we need to copy the orgs, then mutate

				return account.orgs.map(o => ({
					...o,
					default: o.guid.toLowerCase() === String(defaultOrg).toLowerCase()
						|| o.id === ~~defaultOrg
						|| o.name.toLowerCase() === String(defaultOrg).toLowerCase()
				}));
			},

			rename: async (account, org, name) => {
				if (!account || typeof account !== 'object') {
					throw E.INVALID_ACCOUNT('Account required');
				}

				if (!account.isPlatform) {
					throw E.INVALID_PLATFORM_ACCOUNT('Account must be a platform account');
				}

				const found = account.orgs.find(o => {
					return o.guid.toLowerCase() === String(org).toLowerCase()
						|| o.id === ~~org
						|| o.name.toLowerCase() === String(org).toLowerCase();
				});

				if (!found) {
					throw new Error(`Unable to find an organization "${org}"`);
				}

				if (typeof name !== 'string' || !(name = name.trim())) {
					throw new TypeError('Organization name must be a non-empty string');
				}

				const result = await this.request(`/api/v1/org/${found.id}`, account, {
					errorMsg: 'Failed to rename organization',
					json: { name },
					method: 'put'
				});

				result.oldName = found.name;

				return result;
			}
		};

		this.team = {
			create: async ({ account, org, name, description, tags }) => {
				// org_guid
			}
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
			 * @param {Object} [params] - Additional paramters to
			 * @param {Boolean} [params.import] - Registers an existing app with the platform.
			 * @param {Number} [params.org_id] - The organization to register the app with.
			 * @returns {Promise<Object>} Resolves the app info.
			 */
			setApp: async (account, tiapp, params) => {
				if (!tiapp || typeof tiapp !== 'string') {
					throw new TypeError('Expected tiapp to be a non-empty string');
				}
				if (params && typeof params !== 'object') {
					throw new TypeError('Expected params to be an object');
				}
				return await this.request(`/api/v1/app/saveFromTiApp${params ? `?${querystring.stringify(params)}` : ''}`, account, {
					errorMsg: 'Failed to update/register app',
					json: { tiapp }
				});
			}
		};

		this.user = {
			activity: async (account, params) => {
				assertPlatformAccount(account);

				const tsRE = /^\d{4}-\d{2}-\d{2}$/;
				let url = `/api/v1/activity?user_guid=${account.user.guid}&data=true`;
				let ts;
				let from;
				let to = null;

				if (params.from) {
					if (!tsRE.test(params.from) || isNaN(ts = Date.parse(`${params.from} 00:00:00 GMT`))) {
						throw new Error('Expected "from" date to be in the format YYYY-MM-DD');
					}
					from = new Date(ts);
					url += `&from=${from.toISOString()}`;
				} else {
					from = new Date(Date.now() - (14 * 24 * 60 * 60 * 1000)); // 14 days
				}

				if (params.to) {
					if (!tsRE.test(params.to) || isNaN(ts = Date.parse(`${params.to} 23:59:59 GMT`))) {
						throw new Error('Expected "to" date to be in the format YYYY-MM-DD');
					}
					to = new Date(ts);
					url += `&to=${to.toISOString()}`;
				}

				return {
					from,
					to,
					events: await this.request(url, account, {
						errorMsg: 'Failed to get user activity'
					})
				};
			},

			update: async (account, info) => {
				assertPlatformAccount(account);

				await this.request(`/api/v1/user/profile/${account.user.guid}`, account, {
					errorMsg: 'Failed to update user information',
					json: {
						firstname: info.firstname,
						lastname:  info.lastname,
						phone:     info.phone
					},
					method: 'put'
				});

				log('Refreshing account information...');
				return (await this.auth.loadSession(account)).user;
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
				err.message = `Secure token store is not available.\nPlease reinstall the Axway CLI by running:\n    ${isWin ? '' : 'sudo '}npm install --global ${isWin ? '' : '--unsafe-perm '}axway`;
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
				throw new TypeError('Account required');
			}

			const { sid } = account;
			const token = account.auth?.tokens?.access_token;
			if (!sid && !token) {
				throw new Error('Invalid/expired account');
			}

			const url = `${this.platformUrl || this.env.platformUrl}${path}`;
			const headers = {
				Accept: 'application/json',
				'User-Agent': this.userAgent
			};

			if (account.sid) {
				headers.Cookie = `connect.sid=${account.sid}`;
			} else {
				headers.Authorization = `Bearer ${token}`;
			}

			if (!method) {
				method = json ? 'post' : 'get';
			}

			let response;
			const opts = {
				headers,
				json: json ? JSON.parse(JSON.stringify(json)) : undefined,
				responseType: 'json',
				retry: 0
			};
			let err;

			try {
				log(`${method.toUpperCase()} ${highlight(url)} ${note(`(${account.sid ? `sid ${account.sid}` : `token ${token}`})`)}`);
				if (opts.json) {
					log(opts.json);
				}
				response = await this.got[method](url, opts);
			} catch (e) {
				err = e;
			}

			if (err || (path === '/api/v1/auth/findSession' && response.body?.[resultKey] === null)) {
				if (account.sid && err.response?.statusCode === 401) {
					// sid is probably bad, try again with the token
					warn('Platform session was invalidated, trying again to reinitialize session with token');
					headers.Authorization = `Bearer ${token}`;
					delete headers.Cookie;
					log(`${method.toUpperCase()} ${highlight(url)} ${note(`(${account.sid ? `sid ${account.sid}` : `token ${token}`})`)}`);
					response = await this.got[method](url, opts);
				} else  {
					throw err;
				}
			}

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
			if (err.response?.statusCode) {
				err.message += ` (${err.response.statusCode})`;
			}

			const code = err.response?.body?.code;
			if (code) {
				err.code = code;
			}

			throw err;
		}
	}
}

function assertPlatformAccount(account) {
	if (!account || typeof account !== 'object') {
		throw E.INVALID_ACCOUNT('Account required');
	}

	if (!account.isPlatform) {
		throw E.INVALID_PLATFORM_ACCOUNT('Account must be a platform account');
	}
}
