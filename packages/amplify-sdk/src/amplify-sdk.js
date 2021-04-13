import Auth from './auth';
import E from './errors';
import fs from 'fs-extra';
import getEndpoints from './endpoints';
import open from 'open';
import path from 'path';
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
				const result = await this.request('/api/v1/auth/findSession', account, {
					errorMsg: 'Failed to find session'
				});
				account.isPlatform = !!result;

				if (!result) {
					return account;
				}

				const { org, orgs, role, roles, user } = result;

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

				account.role = role;
				account.roles = roles;

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

				if (account.isPlatform) {
					log(`Current org: ${highlight(account.org.name)} ${note(`(${account.org.guid})`)}`);
					log('Available orgs:');
					for (const org of account.orgs) {
						log(`  ${highlight(org.name)} ${note(`(${org.guid})`)}`);
					}
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
			 * @param {Object|String|Number} [org] - The organization object, name, guid, or id.
			 * @returns {Promise<Object>} Resolves the updated account object.
			 */
			switchOrg: async (account, org) => {
				if (!account || account.auth.expired) {
					log(`${account ? 'Account is expired' : 'No account specified'}, doing login`);
					account = await this.client.login();
				} else {
					try {
						org = this.resolveOrg(account, org);
					} catch (err) {
						if (err.code !== 'ERR_INVALID_ACCOUNT' && err.code !== 'ERR_INVALID_PLATFORM_ACCOUNT' && err.code !== 'ERR_INVALID_ARGUMENT') {
							// probably org not found
							throw err;
						}
						org = undefined;
					}

					const server = new Server();
					const { start, url: redirect } = await server.createCallback((req, res) => {
						log(`Telling browser to redirect to ${highlight(this.opts.platformUrl)}`);
						res.writeHead(302, {
							Location: this.opts.platformUrl
						});
						res.end();
					});

					try {
						try {
							const url = createURL(`${this.opts.platformUrl}/#/auth/org.select`, {
								org_id: org?.id,
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
					log('Refreshing the account session...');
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

		/**
		 * Retrieves activity for an organization or user.
		 * @param {Object} account - The account object.
		 * @param {Object} [params] - Various parameters.
		 * @param {String} [params.from] - The start date in ISO format.
		 * @param {Object|String|Number} [params.org] - The organization object, name, guid, or id.
		 * @param {String} [params.to] - The end date in ISO format.
		 * @param {String} [params.userGuid] - The user guid.
		 * @returns {Promise<Object>}
		 */
		const getActivity = async (account, params = {}) => {
			assertPlatformAccount(account);

			let { from, to } = resolveDateRange(params.from, params.to);
			let url = '/api/v1/activity?data=true';

			if (params.org) {
				const { id } = this.resolveOrg(account, params.org);
				url += `&org_id=${id}`;
			}

			if (params.userGuid) {
				url += `&user_guid=${params.userGuid}`;
			}

			if (from) {
				from = from.toISOString();
				url += `&from=${from}`;
			}

			if (to) {
				to = to.toISOString();
				url += `&to=${to}`;
			}

			return {
				from,
				to,
				events: await this.request(url, account, {
					errorMsg: 'Failed to get user activity'
				})
			};
		};

		this.org = {
			/**
			 * Retieves organization activity.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, guid, or id.
			 * @param {Object} [params] - Various parameters.
			 * @param {String} [params.from] - The start date in ISO format.
			 * @param {String} [params.to] - The end date in ISO format.
			 * @returns {Promise<Object>}
			 */
			activity: (account, org, params) => getActivity(account, {
				...params,
				org
			}),

			/**
			 * Retrieves organization details for an account.
			 * @param {Object} account - The account object.
			 * @param {String} org - The organization object, name, id, or guid.
			 * @returns {Promise<Array>}
			 */
			find: async (account, org) => {
				const { id } = this.resolveOrg(account, org);
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
					entitlements:     org.entitlements,
					parentOrg:        null,
					region:           org.region,
					insightUserCount: ~~org.entitlements.limit_read_only_users,
					seats:            org.entitlements.limit_users === 10000 ? null : org.entitlements.limit_users,
					subscriptions,
					teamCount:        (await this.team.list(account, id)).length,
					userCount:        org.users.length,
					userRoles:        org.users.find(u => u.guid === account.user.guid)?.roles
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
					const { children } = await this.org.family(account, id);
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
			environments: async account => {
				assertPlatformAccount(account);
				return await this.request('/api/v1/org/env', account, {
					errorMsg: 'Failed to get organization environments'
				});
			},

			/**
			 * Retrieves the organization family used to determine the child orgs.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, id, or guid.
			 * @returns {Promise<Object>}
			 */
			family: async (account, org) => {
				const { id } = this.resolveOrg(account, org);
				return await this.request(`/api/v1/org/${id}/family`, account, {
					errorMsg: 'Failed to get organization family'
				});
			},

			/**
			 * Retrieves the list of orgs from the specified account.
			 * @param {Object} account - The account object.
			 * @param {String} defaultOrg - The name, id, or guid of the default organization.
			 * @returns {Promise<Array>}
			 */
			list: async (account, defaultOrg) => {
				assertPlatformAccount(account);

				const { guid } = this.resolveOrg(account, defaultOrg);

				return account.orgs.map(o => ({
					...o,
					default: o.guid === guid
				})).sort((a, b) => a.name.localeCompare(b.name));
			},

			user: {
				/**
				 * Adds a user to an org.
				 * @param {Object} account - The account object.
				 * @param {Object|String|Number} org - The organization object, name, id, or guid.
				 * @param {String} email - The user's email.
				 * @param {Array.<String>} roles - One or more roles to assign. Must include a "default" role.
				 * @returns {Promise<Object>}
				 */
				add: async (account, org, email, roles) => {
					org = this.resolveOrg(account, org);
					const { guid } = await this.request(`/api/v1/org/${org.id}/user`, account, {
						errorMsg: 'Failed to add user to organization',
						json: {
							email,
							roles: await this.org.resolveRoles(account, roles)
						}
					});
					log(`User "${guid}" added to org ${org.name} (${org.guid})`);
					return {
						org,
						user: await this.org.user.find(account, org, guid)
					};
				},

				/**
				 * Finds a user and returns their information.
				 * @param {Object} account - The account object.
				 * @param {Object|String|Number} org - The organization object, name, id, or guid.
				 * @param {String} user - The user email or guid.
				 * @returns {Promise<Object>}
				 */
				find: async (account, org, user) => {
					const { users } = await this.org.user.list(account, org);
					user = user.toLowerCase();
					return users.find(m => String(m.email).toLowerCase() === user || String(m.guid).toLowerCase() === user);
				},

				/**
				 * Lists all users in an org.
				 * @param {Object} account - The account object.
				 * @param {Object|String|Number} org - The organization object, name, id, or guid.
				 * @returns {Promise<Object>}
				 */
				list: async (account, org) => {
					org = this.resolveOrg(account, org);
					const users = await this.request(`/api/v1/org/${org.id}/user`, account, {
						errorMsg: 'Failed to get organization users'
					});
					return {
						org,
						users: users.sort((a, b) => {
							const r = a.firstname.localeCompare(b.firstname);
							return r !== 0 ? r : a.lastname.localeCompare(b.lastname);
						})
					};
				},

				/**
				 * Removes an user from an org.
				 * @param {Object} account - The account object.
				 * @param {Object|String|Number} org - The organization object, name, id, or guid.
				 * @param {String} user - The user email or guid.
				 * @returns {Promise<Object>}
				 */
				remove: async (account, org, user) => {
					org = this.resolveOrg(account, org);
					const found = await this.org.user.find(account, org.guid, user);

					if (!found) {
						throw new Error(`Unable to find the user "${user}"`);
					}

					return {
						org,
						user: found,
						...(await this.request(`/api/v1/org/${org.id}/user/${found.guid}`, account, {
							errorMsg: 'Failed to remove user from organization',
							method: 'delete'
						}))
					};
				},

				/**
				 * Updates a users role in an org.
				 * @param {Object} account - The account object.
				 * @param {Object|String|Number} org - The organization object, name, id, or guid.
				 * @param {String} user - The user email or guid.
				 * @param {Array.<String>} roles - One or more roles to assign. Must include a "default" role.
				 * @returns {Promise<Object>}
				 */
				update: async (account, org, user, roles) => {
					org = this.resolveOrg(account, org);
					const found = await this.org.user.find(account, org.guid, user);

					if (!found) {
						throw new Error(`Unable to find the user "${user}"`);
					}

					roles = await this.org.resolveRoles(account, roles);

					return {
						org: await this.request(`/api/v1/org/${org.id}/user/${found.guid}`, account, {
							errorMsg: 'Failed to update user\'s organization roles',
							json: {
								roles
							},
							method: 'put'
						}),
						roles,
						user: await this.org.user.find(account, org, found.guid)
					};
				}
			},

			/**
			 * Renames an org.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, id, or guid.
			 * @param {String} name - The new organization name.
			 * @returns {Promise<Object>}
			 */
			rename: async (account, org, name) => {
				const { id, name: oldName } = this.resolveOrg(account, org);

				if (typeof name !== 'string' || !(name = name.trim())) {
					throw E.INVALID_ARGUMENT('Organization name must be a non-empty string');
				}

				return {
					...(await this.request(`/api/v1/org/${id}`, account, {
						errorMsg: 'Failed to rename organization',
						json: { name },
						method: 'put'
					})),
					oldName
				};
			},

			/**
			 * Fetches the organization roles and validates the list of roles.
			 * @param {Object} account - The account object.
			 * @param {Array.<String>} roles - One or more roles to assign. Must include a "default" role.
			 * @returns {Promise<Object>}
			 */
			resolveRoles: async (account, roles) => {
				if (!Array.isArray(roles)) {
					throw new TypeError('Expected roles to be an array');
				}

				const allowedRoles = await this.role.list(account);
				const defaultRoles = allowedRoles.filter(r => r.default).map(r => r.id);

				if (!roles.length) {
					throw new Error(`Expected at least one of the following roles: ${defaultRoles.join(', ')}`);
				}

				roles = roles
					.flatMap(role => role.split(','))
					.map(role => {
						const lr = role.toLowerCase().trim();
						const found = allowedRoles.find(ar => ar.id === lr || ar.name.toLowerCase() === lr);
						if (!found) {
							throw new Error(`Invalid role "${role}", expected one of the following: ${allowedRoles.map(r => r.id).join(', ')}`);
						}
						return found.id;
					});

				log(`Resolved roles: ${highlight(roles.join(', '))}`);

				if (!roles.some(r => defaultRoles.includes(r))) {
					throw new Error(`You must specify a default role: ${defaultRoles.join(', ')}`);
				}

				return roles;
			},

			/**
			 * Renames an org.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, id, or guid.
			 * @param {Object} [params] - Various parameters.
			 * @param {String} [params.from] - The start date in ISO format.
			 * @param {String} [params.to] - The end date in ISO format.
			 * @returns {Promise<Object>}
			 */
			usage: async (account, org, params = {}) => {
				const { id } = this.resolveOrg(account, org);
				const { from, to } = resolveDateRange(params.from, params.to);

				let url = `/api/v1/org/${id}/usage`;
				if (from) {
					url += `?from=${from.toISOString()}`;
				}
				if (to) {
					url += `${from ? '&' : '?'}to=${to.toISOString()}`;
				}

				return await this.request(url, account, {
					errorMsg: 'Failed to get organization usage'
				});
			}
		};

		this.role = {
			/**
			 * Get all roles.
			 * @param {Object} account - The account object.
			 * @param {Object} [params] - Various parameters.
			 * @param {Boolean} [params.team] - When `true`, returns team specific roles.
			 * @returns {Promise<Object>}
			 */
			list: (account, params) => this.request(
				`/api/v1/role${params ? `?${new URLSearchParams(params).toString()}` : ''}`,
				account,
				{ errorMsg: 'Failed to get roles' }
			)
		};

		/**
		 * Determines team info changes and prepares the team info to be sent.
		 * @param {Object} [info] - The new team info.
		 * @param {Object} [prev] - The previous team info.
		 * @returns {Promise<Object>}
		 */
		const prepareTeamInfo = (info = {}, prev) => {
			if (!info || typeof info !== 'object') {
				throw E.INVALID_ARGUMENT('Expected team info to be an object');
			}

			const changes = {};
			const data = {};

			// populate data
			if (info.default !== undefined) {
				data.default = !!info.default;
			}
			if (info.desc !== undefined) {
				data.desc = String(info.desc).trim();
			}
			if (info.name !== undefined) {
				data.name = String(info.name).trim();
			}
			if (info.tags !== undefined) {
				if (!Array.isArray(info.tags)) {
					throw E.INVALID_ARGUMENT('Expected team tags to be an array of strings');
				}
				data.tags = info.tags.flatMap(tag => tag.split(',')).map(tag => tag.trim());
			}

			// remove unchanged
			if (prev) {
				for (const key of Object.keys(data)) {
					if (Array.isArray(data[key])) {
						if (!(data[key] < prev[key] || data[key] > prev[key])) {
							delete data[key];
						}
					} else if (data[key] === prev[key]) {
						delete data[key];
					} else {
						changes[key] = {
							v: data[key],
							p: prev[key]
						};
					}
				}
			}

			return { changes, data };
		};

		this.team = {
			/**
			 * Creates a team in an org.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, id, or guid.
			 * @param {String} name - The name of the team.
			 * @param {Object} [info] - The team info.
			 * @param {String} [info.desc] - The team description.
			 * @param {Boolean} [info.default] - When `true`, makes this team the default.
			 * @param {Array.<String>} [info.tags] - A list of tags.
			 * @returns {Promise<Object>}
			 */
			create: async (account, org, name, info) => {
				org = this.resolveOrg(account, org);

				if (!name || typeof name !== 'string') {
					throw E.INVALID_ARGUMENT('Expected name to be a non-empty string');
				}

				const { data } = prepareTeamInfo(info);
				data.name = name;
				data.org_guid = org.guid;

				return {
					org,
					team: await this.request('/api/v1/team', account, {
						errorMsg: 'Failed to add team to organization',
						json: data
					})
				};
			},

			/**
			 * Find a team by name or guid.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, id, or guid.
			 * @param {String} team - The team or guid.
			 * @returns {Promise<Object>}
			 */
			find: async (account, org, team) => {
				assertPlatformAccount(account);

				org = this.resolveOrg(account, org);

				if (!team || typeof team !== 'string') {
					throw E.INVALID_ARGUMENT('Expected team to be a name or guid');
				}

				try {
					return {
						org,
						team: await this.request(`/api/v1/team/${team}`, account, {
							errorMsg: 'Failed to get team'
						})
					};
				} catch (e) {
					// maybe `team` is a name?
					const matches = await this.request(`/api/v1/team?name=${team}&org_id=${org.id}`, account, {
						errorMsg: 'Failed to get team'
					});
					if (matches.length > 1) {
						throw new Error(`More than one team matches the name "${team}"`);
					}
					return { org, team: matches[0] };
				}
			},

			/**
			 * List all teams in an org.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, id, or guid.
			 * @returns {Promise<Object>}
			 */
			list: async (account, org) => {
				org = this.resolveOrg(account, org);
				const teams = await this.request(`/api/v1/team?org_id=${org.id}`, account, {
					errorMsg: 'Failed to get organization teams'
				});
				return {
					org,
					teams: teams.sort((a, b) => a.name.localeCompare(b.name))
				};
			},

			user: {
				/**
				 * Adds a user to a team.
				 * @param {Object} account - The account object.
				 * @param {Object|String|Number} org - The organization object, name, id, or guid.
				 * @param {String} team - The team or guid.
				 * @param {String} user - The user email or guid.
				 * @param {Array.<String>} roles - One or more roles to assign. Must include a "default" role.
				 * @returns {Promise<Object>}
				 */
				add: async (account, org, team, user, roles) => {
					({ org, team } = await this.team.find(account, org, team));
					const found  = await this.user.find(account, user);

					if (!found) {
						throw new Error(`Unable to find the user "${user}"`);
					}

					return {
						org,
						team: await this.request(`/api/v1/team/${team.guid}/user/${found.guid}`, account, {
							errorMsg: 'Failed to add user to organization',
							json: {
								roles: await this.team.resolveRoles(account, roles)
							}
						}),
						user: found
					};
				},

				/**
				 * Finds a user in a team.
				 * @param {Object} account - The account object.
				 * @param {Object|String|Number} org - The organization object, name, id, or guid.
				 * @param {String} team - The team or guid.
				 * @param {String} user - The user email or guid.
				 * @returns {Promise<Object>}
				 */
				find: async (account, org, team, user) => {
					let users;
					({ team, users } = await this.team.user.list(account, org, team));
					user = user.toLowerCase();
					return {
						org,
						team,
						user: users.find(m => String(m.email).toLowerCase() === user || String(m.guid).toLowerCase() === user)
					};
				},

				/**
				 * List all users of a team.
				 * @param {Object} account - The account object.
				 * @param {Object|String|Number} org - The organization object, name, id, or guid.
				 * @param {String} team - The team or guid.
				 * @returns {Promise<Object>}
				 */
				list: async (account, org, team) => {
					({ team } = await this.team.find(account, org, team));
					const { users: allUsers } = await this.org.user.list(account, org.guid);
					return {
						org,
						team,
						users: team.users
							.map(u => ({
								...(allUsers.find(v => v.guid === u.guid) || {}),
								roles: u.roles
							}))
							.sort((a, b) => {
								const r = a.firstname.localeCompare(b.firstname);
								return r !== 0 ? r : a.lastname.localeCompare(b.lastname);
							})
					};
				},

				/**
				 * Removes a user from a team.
				 * @param {Object} account - The account object.
				 * @param {Object|String|Number} org - The organization object, name, id, or guid.
				 * @param {String} team - The team or guid.
				 * @param {String} user - The user email or guid.
				 * @returns {Promise<Object>}
				 */
				remove: async (account, org, team, user) => {
					let found;
					({ user: found, team } = await this.team.user.find(account, org, team, user));

					if (!found) {
						throw new Error(`Unable to find the user "${user}"`);
					}

					await this.request(`/api/v1/team/${team.guid}/user/${found.guid}`, account, {
						errorMsg: 'Failed to remove user from team',
						method: 'delete'
					});

					return {
						org,
						team,
						user: found
					};
				},

				/**
				 * Updates a user's role in a team.
				 * @param {Object} account - The account object.
				 * @param {Object|String|Number} org - The organization object, name, id, or guid.
				 * @param {String} team - The team or guid.
				 * @param {String} user - The user email or guid.
				 * @param {Array.<String>} roles - One or more roles to assign. Must include a "default" role.
				 * @returns {Promise<Object>}
				 */
				update: async (account, org, team, user, roles) => {
					let found;
					({ user: found, team } = await this.team.user.find(account, org, team, user));

					if (!found) {
						throw new Error(`Unable to find the user "${user}"`);
					}

					roles = await this.team.resolveRoles(account, roles);

					team = await this.request(`/api/v1/team/${team.guid}/user/${found.guid}`, account, {
						errorMsg: 'Failed to update user\'s organization roles',
						json: {
							roles
						},
						method: 'put'
					});

					found.roles = team.users.reduce((v, u) => {
						return u.guid === found.guid ? u.roles : v;
					}, []);

					return {
						org,
						team,
						user: found,
						roles
					};
				}
			},

			/**
			 * Fetches the team roles and validates the list of roles.
			 * @param {Object} account - The account object.
			 * @param {Array.<String>} roles - One or more roles to assign. Must include a "default" role.
			 * @returns {Promise<Object>}
			 */
			resolveRoles: async (account, roles) => {
				if (!Array.isArray(roles)) {
					throw new TypeError('Expected roles to be an array');
				}

				const allowedRoles = await this.role.list(account, { team: true });

				if (!roles.length) {
					throw new Error(`Expected at least one of the following roles: ${allowedRoles.map(r => r.id).join(', ')}`);
				}

				roles = roles
					.flatMap(role => role.split(','))
					.map(role => {
						const lr = role.toLowerCase().trim();
						const found = allowedRoles.find(ar => ar.id === lr || ar.name.toLowerCase() === lr);
						if (!found) {
							throw new Error(`Invalid role "${role}", expected one of the following: ${allowedRoles.map(r => r.id).join(', ')}`);
						}
						return found.id;
					});

				return roles;
			},

			/**
			 * Removes a team from an organization.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, id, or guid.
			 * @param {String} team - The team or guid.
			 * @returns {Promise<Object>}
			 */
			remove: async (account, org, team) => {
				const origTeam = team;
				({ org, team } = await this.team.find(account, org, team));

				if (!team) {
					throw new Error(`Unable to find team "${origTeam}" in the "${org.name}" organization`);
				}

				await this.request(`/api/v1/team/${team.guid}`, account, {
					errorMsg: 'Failed to remove team',
					method: 'delete'
				});

				return { org, team };
			},

			/**
			 * Updates team information.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, id, or guid.
			 * @param {String} team - The team or guid.
			 * @param {Object} [info] - The team info.
			 * @param {String} [info.desc] - The team description.
			 * @param {Boolean} [info.default] - When `true`, makes this team the default.
			 * @param {Array.<String>} [info.tags] - A list of tags.
			 * @returns {Promise<Object>}
			 */
			update: async (account, org, team, info) => {
				const origTeam = team;
				({ org, team } = await this.team.find(account, org, team));

				if (!team) {
					throw new Error(`Unable to find team "${origTeam}" in the "${org.name}" organization`);
				}

				const { changes, data } = prepareTeamInfo(info, team);

				if (Object.keys(data).length) {
					team = await this.request(`/api/v1/team/${team.guid}`, account, {
						errorMsg: 'Failed to update team',
						json: data,
						method: 'put'
					});
				}

				return {
					changes,
					org,
					team
				};
			}
		};

		this.user = {
			/**
			 * Retrieves an account's user's activity.
			 * @param {Object} account - The account object.
			 * @param {Object} [params] - Various parameters.
			 * @param {String} [params.from] - The start date in ISO format.
			 * @param {String} [params.to] - The end date in ISO format.
			 * @returns {Promise<Object>}
			 */
			activity: (account, params) => getActivity(account, {
				...params,
				userGuid: account.user.guid
			}),

			/**
			 * Retrieves a user's information.
			 * @param {Object} account - The account object.
			 * @param {String} user - The user email or guid.
			 * @returns {Promise<Object>}
			 */
			find: async (account, user) => {
				assertPlatformAccount(account);

				if (typeof user === 'object' && user?.guid) {
					return user;
				}

				try {
					if (!user.includes('@')) {
						return await this.request(`/api/v1/user/${user}`, account, {
							errorMsg: 'Failed to find user'
						});
					}

					const users = await this.request(`/api/v1/user?term=${user}`, account, {
						errorMsg: 'Failed to find user'
					});

					if (users.length > 0) {
						return users[0];
					}
				} catch (err) {
					warn(err.toString());
				}

				throw new Error(`User "${user}" not found`);
			},

			/**
			 * Updates an account's user's information.
			 * @param {Object} account - The account object.
			 * @param {Object} [info] - Various user fields.
			 * @param {String} [info.firstname] - The user's first name.
			 * @param {String} [info.lastname] - The user's last name.
			 * @param {String} [info.phone] - The user's phone number.
			 * @returns {Promise<Object>}
			 */
			update: async (account, info = {}) => {
				assertPlatformAccount(account);

				if (!info || typeof info !== 'object') {
					throw E.INVALID_ARGUMENT('Expected user info to be an object');
				}

				const changes = {};
				const json = {};
				let { user } = account;

				// populate data
				if (info.firstname !== undefined) {
					json.firstname = String(info.firstname).trim();
				}
				if (info.lastname !== undefined) {
					json.lastname = String(info.lastname).trim();
				}
				if (info.phone !== undefined) {
					json.phone = String(info.phone).trim();
				}

				// remove unchanged
				for (const key of Object.keys(json)) {
					if (json[key] === user[key]) {
						delete json[key];
					} else {
						changes[key] = {
							v: json[key],
							p: user[key]
						};
					}
				}

				if (Object.keys(json).length) {
					await this.request(`/api/v1/user/profile/${user.guid}`, account, {
						errorMsg: 'Failed to update user information',
						json,
						method: 'put'
					});

					log('Refreshing account information...');
					({ user } = await this.auth.loadSession(account));
				}

				return {
					changes,
					user
				};
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
			let error;

			try {
				log(`${method.toUpperCase()} ${highlight(url)} ${note(`(${account.sid ? `sid ${account.sid}` : `token ${token}`})`)}`);
				if (opts.json) {
					log(opts.json);
				}
				response = await this.got[method](url, opts);
			} catch (e) {
				error = e;
			}

			if (error || (path === '/api/v1/auth/findSession' && response.body?.[resultKey] === null)) {
				if (account.sid && error.response?.statusCode === 401) {
					// sid is probably bad, try again with the token
					warn('Platform session was invalidated, trying again to reinitialize session with token');
					headers.Authorization = `Bearer ${token}`;
					delete headers.Cookie;
					log(`${method.toUpperCase()} ${highlight(url)} ${note(`(${account.sid ? `sid ${account.sid}` : `token ${token}`})`)}`);
					response = await this.got[method](url, opts);
				} else if (error) {
					throw error;
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

	/**
	 * Resolves an org by name, id, org guid using the specified account.
	 *
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} [org] - The organization object, name, guid, or id.
	 * @returns {Promise<Object>} Resolves the org info from the account object.
	 * @access public
	 */
	resolveOrg(account, org) {
		assertPlatformAccount(account);

		if (org && typeof org === 'object' && org.guid) {
			return org;
		}

		if (org === undefined) {
			org = account.org.guid;
		}

		if (typeof org !== 'string' && typeof org !== 'number') {
			throw E.INVALID_ARGUMENT('Expected organization identifier');
		}

		const found = account.orgs.find(o => {
			return o.guid.toLowerCase() === String(org).toLowerCase()
				|| o.id === ~~org
				|| o.name.toLowerCase() === String(org).toLowerCase();
		});

		if (!found) {
			throw new Error(`Unable to find the organization "${org}"`);
		}

		log(`Resolved org "${org}" as ${found.name} (${found.id}) ${found.guid}`);

		return found;
	}
}

/**
 * Checks that the specified account is a platform account.
 *
 * @param {Object} account - The account object.
 */
function assertPlatformAccount(account) {
	if (!account || typeof account !== 'object') {
		throw E.INVALID_ACCOUNT('Account required');
	}

	if (!account.isPlatform) {
		throw E.INVALID_PLATFORM_ACCOUNT('Account must be a platform account');
	}
}

/**
 * Takes two date strings in the format `YYYY-MM-DD` and returns them as date objects.
 *
 * @param {String} [from] - The range start date.
 * @param {String} [to] - The range end date.
 * @returns {Object}
 */
function resolveDateRange(from, to) {
	const r = {
		from: null,
		to: null
	};
	const tsRE = /^\d{4}-\d{2}-\d{2}$/;
	let ts;

	if (from) {
		if (!tsRE.test(from) || isNaN(ts = Date.parse(`${from} 00:00:00 GMT`))) {
			throw new Error('Expected "from" date to be in the format YYYY-MM-DD');
		}
		r.from = new Date(ts);
	} else {
		r.from = new Date(Date.now() - (14 * 24 * 60 * 60 * 1000)); // 14 days
	}

	if (to) {
		if (!tsRE.test(to) || isNaN(ts = Date.parse(`${to} 23:59:59 GMT`))) {
			throw new Error('Expected "to" date to be in the format YYYY-MM-DD');
		}
		r.to = new Date(ts);
	} else {
		r.to = new Date();
	}

	return r;
}
