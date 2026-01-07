import Auth from './auth.js';
import E from './errors.js';
import logger, { highlight, note } from '../logger.js';
import * as environments from '../environments.js';
import * as request from '../request.js';
import _ from 'lodash';
import { redact } from '../redact.js';

import { type Got } from 'got';

const { log, warn } = logger('amplify-sdk');

/**
 * An SDK for accessing Amplify API's.
 */
export default class AmplifySDK {
	/** Resolved environment-specific settings. */
	env: any;
	opts: any;
	got: Got;

	/** The base Axway ID URL. */
	baseUrl: string | null;
	/** The platform URL. */
	platformUrl: string | null;
	/** The profile name for profile-specific settings. */
	profile: string | null;

	auth: AmplifyAuthSDK;
	client: AmplifyClientSDK;
	entitlement: AmplifyEntitlementSDK;
	org: AmplifyOrgSDK;
	role: AmplifyRoleSDK;
	team: AmplifyTeamSDK;
	user: AmplifyUserSDK;

	#authClient: Auth;

	/**
	 * Initializes the environment and SDK's API.
	 *
	 * @param {Object} opts - Authentication options.
	 * @param {Object} [opts.env=prod] - The environment name.
	 * @param {Object} [opts.requestOptions] - HTTP request options with proxy settings and such to
	 * create a `got` HTTP client.
	 */
	constructor(opts: any = {}) {
		if (typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		/**
		 * Authentication options including baseURL, clientID, env, realm, and token store settings.
		 * @type {Object}
		 */
		this.opts = { ...opts };
		// TODO: These can be removed in a future version
		delete this.opts.username;
		delete this.opts.password;

		this.env = environments.resolve(opts.env);
		this.profile = opts.profile || null;

		// set the defaults based on the environment
		for (const prop of [ 'baseUrl', 'platformUrl', 'realm' ]) {
			if (!opts[prop]) {
				opts[prop] = _.get(this.env, prop);
			}
		}

		this.got = request.init(opts.requestOptions);
		if (!opts.got) {
			opts.got = this.got;
		}

		this.baseUrl = opts.baseUrl ? opts.baseUrl.replace(/\/$/, '') : null;
		this.platformUrl = opts.platformUrl ? opts.platformUrl.replace(/\/$/, '') : null;

		this.auth = {
			find: async (accountName, defaultTeams, sanitize) => {
				const account = await this.authClient.find(accountName);
				return account ? await this.auth.loadSession(account, defaultTeams, sanitize) : null;
			},

			findSession: async (account, defaultTeams) => {
				if (!account || typeof account !== 'object') {
					throw new TypeError('Account required');
				}
				if (defaultTeams && typeof defaultTeams !== 'object') {
					throw E.INVALID_ARGUMENT('Expected default teams to be an object');
				}

				if (account.org?.id) {
					const org = await this.org.find(account, account.org.guid);
					org.org_id = org.org_id || org.id;
					account.org = {
						entitlements: Object
							.entries(org.entitlements || {})
							.reduce((obj, [ name, value ]) => {
								if (name[0] !== '_') {
									obj[name] = value;
								}
								return obj;
							}, {}),
						guid: org.guid,
						id: org.org_id,
						org_id: org.org_id,
						name: org.name,
						region: org.region,
						subscriptions: org.subscriptions || [],
						teams: []
					};

					// TODO: Service accounts can only be part of one org, so remove orgs array?
					account.orgs = [ {
						default: true,
						guid: org.guid,
						id: org.org_id,
						name: org.name
					} ];
				}

				account.team = undefined;

				if (account.user.guid) {
					const [
						{ teams },
						client
					] = await Promise.all([
						this.team.list(account, account.org?.id, account.user.guid),
						this.request(`/api/v1/client/${account.user.guid}`, account, {
							errorMsg: 'Failed to fetch service account'
						})
					]);
					account.org.teams = teams;
					account.user.roles = client.roles || [];

					const selectedTeamGuid = defaultTeams?.[account.hash];

					if (teams.length) {
						const team = teams.find(t => (selectedTeamGuid && t.guid === selectedTeamGuid) || (!selectedTeamGuid && t.default)) || teams[0];
						account.team = {
							default: team.default,
							guid: team.guid,
							name: team.name,
							roles: account.user.guid && team.users?.find(u => u.guid === account.user.guid)?.roles || [],
							tags: team.tags
						};
					}
				}

				return account;
			},

			list: async (opts) => {
				if (!opts || typeof opts !== 'object') {
					throw E.INVALID_ARGUMENT('Expected options to be an object');
				}

				const accounts = await this.authClient.list();
				const result = [];
				for (let account of accounts) {
					if (opts.validate && (!opts.skip || !opts.skip.includes(account.name))) {
						try {
							account = await this.auth.find(account.name, opts.defaultTeams, opts.sanitize);
						} catch (err) {
							warn(`Failed to load session for account "${account.name}": ${err.toString()}`);
						}
					}
					// Sanitize sensitive auth info unless requested otherwise
					if (account?.auth && opts.sanitize !== false) {
						delete account.auth.clientSecret;
						delete account.auth.secret;
						// TODO: Remove username/password refs in a future version
						delete account.auth.username;
						delete account.auth.password;
					}
					if (account?.auth) {
						result.push(account);
					}
				}
				return result.sort((a, b) => a.name.localeCompare(b.name));
			},

			loadSession: async (account, defaultTeams, sanitize) => {
				try {
					account = await this.auth.findSession(account, defaultTeams);
				} catch (err) {
					if (err.code === 'ERR_SESSION_INVALIDATED') {
						warn(`Detected invalidated session, purging account ${highlight(account.name)}`);
						await this.authClient.logout({
							accounts: [ account.name ],
							baseUrl: this.baseUrl
						});
						return null;
					}
					throw err;
				}

				await this.authClient.updateAccount(account);

				if (sanitize !== false) {
					delete account.auth.clientSecret;
					delete account.auth.password;
					delete account.auth.secret;
					delete account.auth.username;
				}

				return account;
			},

			login: async (opts = {}) => {
				let account;

				// check if already logged in
				if (!opts?.force) {
					account = await this.authClient.find(opts);
					if (account && !account.auth.expired) {
						warn(`Account ${highlight(account.name)} is already authenticated`);
						const err = new Error('Account already authenticated') as any;
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

				// do the login
				account = await this.authClient.login(opts);
				return await this.auth.loadSession(account);
			},

			logout: async ({ accounts: accountIds, all, baseUrl = this.baseUrl } = {}) => {
				let accounts;
				if (all) {
					accounts = await this.authClient.list();
				} else {
					if (!Array.isArray(accounts)) {
						throw E.INVALID_ARGUMENT('Expected accounts to be a list of accounts');
					}
					if (!accountIds.length) {
						return [];
					}
					accounts = (await this.authClient.list()).filter(account => accountIds.includes(account.name));
				}

				return await this.authClient.logout({ accounts: accounts.map(account => account.hash), baseUrl });
			},

			serverInfo: opts => this.authClient.serverInfo(opts)
		};

		this.client = {
			create: async (account, _org, opts) => {
				const org = this.resolveOrg(account, _org);

				if (!opts || typeof opts !== 'object') {
					throw E.INVALID_ARGUMENT('Expected options to be an object');
				}

				if (!opts.name || typeof opts.name !== 'string') {
					throw E.INVALID_ARGUMENT('Expected name to be a non-empty string');
				}

				if (opts.desc && typeof opts.desc !== 'string') {
					throw E.INVALID_ARGUMENT('Expected description to be a string');
				}

				const data: any = {
					name: opts.name,
					description: opts.desc || '',
					org_guid: org.guid
				};

				if (opts.publicKey) {
					if (typeof opts.publicKey !== 'string') {
						throw E.INVALID_ARGUMENT('Expected public key to be a string');
					}
					if (!opts.publicKey.startsWith('-----BEGIN PUBLIC KEY-----')) {
						throw new Error('Expected public key to be PEM formatted');
					}
					data.type = 'certificate';
					data.publicKey = opts.publicKey;
				} else if (opts.secret) {
					if (typeof opts.secret !== 'string') {
						throw E.INVALID_ARGUMENT('Expected secret to be a string');
					}
					data.type = 'secret';
					data.secret = opts.secret;
				} else {
					throw new Error('Expected public key or secret');
				}

				if (opts.roles) {
					data.roles = await this.role.resolve(account, opts.roles, { org });
				}

				if (opts.teams) {
					data.teams = await this.client.resolveTeams(account, org, opts.teams);
				}

				return {
					org,
					client: await this.request('/api/v1/client', account, {
						errorMsg: 'Failed to create service account',
						json: data
					})
				};
			},

			find: async (account, org, term) => {
				const { clients } = await this.client.list(account, org);

				// first try to find the service account by guid or client id, then name
				const client = clients.find(c => c.guid === term || c.client_id === term)
					|| clients.find(c => c.name === term);

				// if still not found, error
				if (!client) {
					throw new Error(`Service account "${term}" not found`);
				}

				// get service account description
				const { description } = await this.request(`/api/v1/client/${client.client_id}`, account, {
					errorMsg: 'Failed to get service account'
				});

				client.description = description;

				const { teams } = await this.team.list(account, client.org_guid);
				client.teams = [];
				for (const team of teams) {
					const user = team.users.find(u => u.type === 'client' && u.guid === client.guid);
					if (user) {
						client.teams.push({
							...team,
							roles: user.roles
						});
					}
				}

				return {
					org: await this.org.find(account, client.org_guid),
					client
				};
			},

			list: async (account, _org) => {
				const org = this.resolveOrg(account, _org);
				const clients = await this.request(`/api/v1/client?org_id=${org.id}`, account, {
					errorMsg: 'Failed to get service accounts'
				});

				return {
					org,
					clients: clients
						.map(c => {
							c.method = this.client.resolveType(c.type);
							return c;
						})
						.sort((a, b) => a.name.localeCompare(b.name))
				};
			},

			remove: async (account, _org, _client) => {
				const { client, org } = await this.client.resolveClient(account, _org, _client);

				await this.request(`/api/v1/client/${client.client_id}`, account, {
					errorMsg: 'Failed to remove service account',
					method: 'delete'
				});

				return { client, org };
			},

			resolveClient: async (account, _org, _client) => {
				const org = this.resolveOrg(account, _org);
				if (_client?.client_id) {
					return {
						org,
						client: _client
					};
				}

				if (typeof _client === 'string') {
					return await this.client.find(account, org, _client);
				}

				throw E.INVALID_ARGUMENT('Expected client to be an object or client id');
			},

			resolveTeams: async (account, org, teams) => {
				if (!Array.isArray(teams)) {
					throw E.INVALID_ARGUMENT('Expected teams to be an array');
				}

				if (!teams.length) {
					return [];
				}

				const { teams: availableTeams } = await this.team.list(account, org);
				const teamRoles = await this.role.list(account, { team: true, org });
				const guids = {};
				const resolvedTeams = [];

				for (const team of teams) {
					if (!team || typeof team !== 'object' || !team.guid || typeof team.guid !== 'string' || !team.roles || !Array.isArray(team.roles) || !team.roles.length) {
						throw E.INVALID_ARGUMENT('Expected team to be an object containing a guid and array of roles');
					}

					// find the team by name or guid
					const lt = team.guid.toLowerCase().trim();
					const found = availableTeams.find(t => t.guid === lt || t.name.toLowerCase() === lt);
					if (!found) {
						throw new Error(`Invalid team "${team.guid}"`);
					}

					// validate roles
					for (const role of team.roles) {
						if (!teamRoles.find(r => r.id === role)) {
							throw new Error(`Invalid team role "${role}"`);
						}
					}

					// dedupe
					if (guids[found.guid]) {
						continue;
					}
					guids[found.guid] = 1;

					resolvedTeams.push({
						guid: found.guid,
						roles: team.roles
					});
				}

				return resolvedTeams;
			},

			resolveType(type) {
				return type === 'secret' ? 'Client Secret' : type === 'certificate' ? 'Client Certificate' : 'Other';
			},

			update: async (account, _org, opts: any = {}) => {
				if (!opts || typeof opts !== 'object') {
					throw E.INVALID_ARGUMENT('Expected options to be an object');
				}

				const { client, org } = await this.client.resolveClient(account, _org, opts.client);
				const data: any = {};

				if (opts.name) {
					if (typeof opts.name !== 'string') {
						throw E.INVALID_ARGUMENT('Expected name to be a non-empty string');
					}
					data.name = opts.name;
				}

				if (opts.desc) {
					if (typeof opts.desc !== 'string') {
						throw E.INVALID_ARGUMENT('Expected description to be a string');
					}
					data.description = opts.desc;
				}

				if (opts.publicKey) {
					if (typeof opts.publicKey !== 'string') {
						throw E.INVALID_ARGUMENT('Expected public key to be a string');
					}
					if (!opts.publicKey.startsWith('-----BEGIN PUBLIC KEY-----')) {
						throw new Error('Expected public key to be PEM formatted');
					}
					if (client.type !== 'certificate') {
						throw new Error(`Service account "${client.name}" uses auth method "${this.client.resolveType(client.type)}" and cannot be changed to "${this.client.resolveType('certificate')}"`);
					}
					data.publicKey = opts.publicKey;
				} else if (opts.secret) {
					if (typeof opts.secret !== 'string') {
						throw E.INVALID_ARGUMENT('Expected secret to be a string');
					}
					if (client.type !== 'secret') {
						throw new Error(`Service account "${client.name}" uses auth method "${this.client.resolveType(client.type)}" and cannot be changed to "${this.client.resolveType('secret')}"`);
					}
					data.secret = opts.secret;
				}

				if (opts.roles !== undefined) {
					data.roles = !opts.roles ? [] : await this.role.resolve(account, opts.roles, { org });
				}

				if (opts.teams !== undefined) {
					data.teams = opts.teams && await this.client.resolveTeams(account, org, opts.teams) || [];
				}

				return {
					org,
					client: await this.request(`/api/v1/client/${client.guid}`, account, {
						errorMsg: 'Failed to update service account',
						json: data,
						method: 'put'
					})
				};
			}
		};

		this.entitlement = {
			find: (account, metric) => this.request(`/api/v1/entitlement/${metric}`, account, {
				errorMsg: 'Failed to get entitlement info'
			})
		};

		this.org = {
			activity: (account, org, params) => getActivity(account, {
				...params,
				org
			}),

			environments: async account => {
				return await this.request('/api/v1/org/env', account, {
					errorMsg: 'Failed to get organization environments'
				});
			},

			/**
			 * Retrieves organization details for an account.
			 * @param {Account} account - The account object.
			 * @param {String} org - The organization object, name, id, or guid.
			 * @returns {Promise<Array>}
			 */
			find: async (account, _org) => {
				const { id } = this.resolveOrg(account, _org);
				const org = await this.request(`/api/v1/org/${id}`, account, {
					errorMsg: 'Failed to get organization'
				});

				const subscriptions = org.subscriptions.map(s => ({
					product: s.product,
					plan: s.plan,
					expired: Boolean(s.expired),
					governance: s.governance || 'SaaS',
					start_date: s.start_date,
					end_date: s.end_date,
					tier: s.tier,

					// TODO: Remove these unnecessary mappings once everything has been ported and updated
					category: s.product,
					edition: s.plan,
					startDate: s.start_date,
					endDate: s.end_date
				}));

				const { teams } = await this.team.list(account, id);

				const result: Organization = {
					active: org.active,
					created: org.created,
					guid: org.guid,
					org_id: org.org_id,
					id,
					name: org.name,
					entitlements: org.entitlements,
					region: org.region,
					subscriptions,
					teams,
					teamCount: teams.length,
					userCount: org.users.length
				};

				if (org.entitlements?.partners) {
					for (const partner of org.entitlements.partners) {
						result[partner] = org[partner];
					}
				}

				return result;
			},

			list: async (account, defaultOrg) => {
				const { guid } = this.resolveOrg(account, defaultOrg);

				return account.orgs.map(o => ({
					...o,
					default: o.guid === guid
				})).sort((a, b) => a.name.localeCompare(b.name));
			},

			user: {
				add: async (account, _org, email, roles) => {
					const org = this.resolveOrg(account, _org);
					const { guid } = await this.request(`/api/v1/org/${org.id}/user`, account, {
						errorMsg: 'Failed to add user to organization',
						json: {
							email,
							roles: await this.role.resolve(account, roles, { org, requireDefaultRole: true })
						}
					});
					log(`User "${guid}" added to org ${org.name} (${org.guid})`);
					return {
						org,
						user: await this.org.user.find(account, org, guid)
					};
				},

				find: async (account, org, user) => {
					const { users } = await this.org.user.list(account, org);
					user = user.toLowerCase();
					return users.find(m => String(m.email).toLowerCase() === user || String(m.guid).toLowerCase() === user);
				},

				list: async (account, _org) => {
					const org = this.resolveOrg(account, _org);
					const users = await this.request(`/api/v1/org/${org.id}/user?clients=1`, account, {
						errorMsg: 'Failed to get organization users'
					});
					return {
						org,
						users: users.sort((a, b) => {
							if ((a.client_id && !b.client_id) || (!a.client_id && b.client_id)) {
								return !a.client_id ? -1 : a.client_id ? 1 : 0;
							}
							const aname = a.name || `${a.firstname} ${a.lastname}`.trim();
							const bname = b.name || `${b.firstname} ${b.lastname}`.trim();
							return aname.localeCompare(bname);
						})
					};
				},

				remove: async (account, _org, user) => {
					const org = this.resolveOrg(account, _org);
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

				update: async (account, _org, user, roles) => {
					const org = this.resolveOrg(account, _org);
					const found = await this.org.user.find(account, org.guid, user);

					if (!found) {
						throw new Error(`Unable to find the user "${user}"`);
					}

					roles = await this.role.resolve(account, roles, { org, requireDefaultRole: true });

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

			rename: async (account, _org, name) => {
				const { id, name: oldName } = this.resolveOrg(account, _org);

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

			usage: async (account, org, params: any = {}) => {
				const { id } = this.resolveOrg(account, org);

				if (params.month !== undefined) {
					Object.assign(params, resolveMonthRange(params.month));
				}

				const { from, to } = resolveDateRange(params.from, params.to);

				let url = `/api/v1/org/${id}/usage`;
				if (from) {
					url += `?from=${from.toISOString()}`;
				}
				if (to) {
					url += `${from ? '&' : '?'}to=${to.toISOString()}`;
				}

				const results: any = await this.request(url, account, {
					errorMsg: 'Failed to get organization usage'
				});

				if (results.bundle?.metrics) {
					for (const [ metric, info ] of Object.entries(results.bundle.metrics) as any) {
						if (!info.name) {
							info.name = (await this.entitlement.find(account, metric)).title;
						}
					}
				}

				return {
					...results,
					from,
					to
				};
			}
		};

		this.role = {
			list: async (account, params = {}) => {
				let roles = await this.request(
					`/api/v1/role${params.team ? '?team=true' : ''}`,
					account,
					{ errorMsg: 'Failed to get roles' }
				);
				if (params.team) {
					return roles.filter(r => r.team);
				}
				const _org = params.org || account.org?.guid;
				if (_org) {
					const org = await this.org.find(account, _org);
					const { entitlements, subscriptions } = org;

					roles = roles.filter(role => {
						return role.org
							&& (!role.partner || (entitlements.partners || []).includes(role.partner) && org[role.partner]?.provisioned)
							&& (!role.entitlement || entitlements[role.entitlement])
							&& (!role.subscription || subscriptions.find(sub => {
								return new Date(sub.end_date) >= new Date() && role.subscription.includes(sub.product);
							}));
					});
				}

				if (params.default) {
					return roles.filter(r => r.default);
				}
				return roles;
			},

			resolve: async (account, roles, opts) => {
				if (!Array.isArray(roles)) {
					throw E.INVALID_ARGUMENT('Expected roles to be an array');
				}

				if (!roles.length && !opts.requireRoles && !opts.requireDefaultRole) {
					return [];
				}

				const allowedRoles = await this.role.list(account, {
					default: opts.default,
					org: opts.org,
					team: opts.team
				});
				const defaultRoles = allowedRoles.filter(r => r.default).map(r => r.id);

				if (!roles.length && opts.requireDefaultRole) {
					throw new Error(`Expected at least one of the following roles: ${defaultRoles.join(', ')}`);
				}
				if (!roles.length && opts.requireRoles) {
					throw new Error(`Expected at least one of the following roles: ${allowedRoles.join(', ')}`);
				}

				roles = roles
					.reduce((arr, role) => arr.concat(role.split(',')), [])
					.map(role => {
						const lr = role.toLowerCase().trim();
						const found = allowedRoles.find(ar => ar.id === lr || ar.name.toLowerCase() === lr);
						if (!found) {
							throw new Error(`Invalid role "${role}", expected one of the following: ${allowedRoles.map(r => r.id).join(', ')}`);
						}
						return found.id;
					});

				log(`Resolved roles: ${highlight(roles.join(', '))}`);

				if (opts.requireDefaultRole && !roles.some(r => defaultRoles.includes(r))) {
					throw new Error(`You must specify a default role: ${defaultRoles.join(', ')}`);
				}

				return roles;
			}
		};

		this.team = {
			create: async (account, _org, name, info) => {
				const org = this.resolveOrg(account, _org);

				if (!name || typeof name !== 'string') {
					throw E.INVALID_ARGUMENT('Expected name to be a non-empty string');
				}

				const { data } = prepareTeamInfo(info);
				data.name = name;
				data.org_guid = org.guid;

				return {
					org,
					team: await this.request('/api/v1/team', account, {
						errorMsg: 'Failed to create team',
						json: data
					})
				};
			},

			find: async (account, _org, team) => {
				const org = this.resolveOrg(account, _org);

				if (!team || typeof team !== 'string') {
					throw E.INVALID_ARGUMENT('Expected team to be a name or guid');
				}

				const origTeam = team;
				const { teams } = await this.team.list(account, org);
				team = team.toLowerCase();
				team = teams.find(t => t.name.toLowerCase() === team || t.guid === team);

				if (!team) {
					throw new Error(`Unable to find team "${origTeam}" in the "${org.name}" organization`);
				}

				return { org, team };
			},

			list: async (account, _org, user) => {
				const org = _org && this.resolveOrg(account, _org);
				let teams = await this.request(`/api/v1/team${org?.id ? `?org_id=${org.id}` : ''}`, account, {
					errorMsg: 'Failed to get organization teams'
				});

				if (user) {
					teams = teams.filter(team => {
						return team.users?.find(u => u.guid === user);
					});
				}

				return {
					org,
					teams: teams.sort((a, b) => a.name.localeCompare(b.name))
				};
			},

			user: {
				add: async (account, _org, _team, user, roles) => {
					const { org, team } = await this.team.find(account, _org, _team);

					const found = await this.org.user.find(account, org.guid, user);
					if (!found) {
						throw new Error(`Unable to find the user "${user}"`);
					}

					return {
						org,
						team: await this.request(`/api/v1/team/${team.guid}/user/${found.guid}`, account, {
							errorMsg: 'Failed to add user to organization',
							json: {
								roles: await this.role.resolve(account, roles, { org, requireRoles: true, team: true }),
								type: found.client_id ? 'client' : 'user'
							}
						}),
						user: found
					};
				},

				find: async (account, _org, _team, user) => {
					const { org, team, users } = await this.team.user.list(account, _org, _team);
					user = user.toLowerCase();
					return {
						org,
						team,
						user: users.find(m => String(m.email).toLowerCase() === user || String(m.guid).toLowerCase() === user)
					};
				},

				list: async (account, _org, _team) => {
					const { org, team } = await this.team.find(account, _org, _team);
					const { users: orgUsers } = await this.org.user.list(account, org.guid);
					const users = [];

					for (const user of team.users) {
						if (user.type === 'client') {
							const { client } = await this.client.find(account, org, user.guid);
							users.push({
								...client,
								roles: user.roles,
								teams: client.teams.length,
								type: user.type
							});
						} else {
							const orgUser = orgUsers.find(v => v.guid === user.guid);
							if (orgUser) {
								users.push({
									...orgUser,
									name: `${orgUser.firstname} ${orgUser.lastname}`.trim(),
									roles: user.roles,
									type: user.type || 'user'
								});
							} else {
								warn(`Unknown team user "${user.guid}"`);
							}
						}
					}

					return {
						org,
						team,
						users: users.sort((a, b) => {
							if (a.type !== b.type) {
								return a.type === 'user' ? -1 : a.type === 'client' ? 1 : 0;
							}
							return a.name.localeCompare(b.name);
						})
					};
				},

				remove: async (account, _org, _team, user) => {
					const { user: found, org, team } = await this.team.user.find(account, _org, _team, user);

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

				update: async (account, _org, _team, user, roles) => {
					const { user: found, org, team } = await this.team.user.find(account, _org, _team, user);

					if (!found) {
						throw new Error(`Unable to find the user "${user}"`);
					}

					roles = await this.role.resolve(account, roles, { org, requireRoles: true, team: true });

					const updatedTeam = await this.request(`/api/v1/team/${team.guid}/user/${found.guid}`, account, {
						errorMsg: 'Failed to update user\'s organization roles',
						json: {
							roles
						},
						method: 'put'
					});

					found.roles = updatedTeam.users.reduce((v, u) => {
						return u.guid === found.guid ? u.roles : v;
					}, []);

					return {
						org,
						team: updatedTeam,
						user: found,
						roles
					};
				}
			},

			remove: async (account, _org, _team) => {
				const { org, team } = await this.team.find(account, _org, _team);

				await this.request(`/api/v1/team/${team.guid}`, account, {
					errorMsg: 'Failed to remove team',
					method: 'delete'
				});

				return { org, team };
			},

			update: async (account, _org, _team, info) => {
				const { org, team } = await this.team.find(account, _org, _team);

				const { changes, data } = prepareTeamInfo(info, team);

				let updatedTeam = team;
				if (Object.keys(data).length) {
					updatedTeam = await this.request(`/api/v1/team/${team.guid}`, account, {
						errorMsg: 'Failed to update team',
						json: data,
						method: 'put'
					});
				}

				return {
					changes,
					org,
					team: updatedTeam
				};
			}
		};

		this.user = {
			activity: async () => {
				throw new Error('Platform user activity can no longer be requested via the SDK.');
			},

			find: async (account, _user) => {
				if (typeof _user === 'object' && _user?.guid) {
					return _user;
				}

				const user = _user as string;

				try {
					return await this.request(`/api/v1/user/${user}`, account, {
						errorMsg: 'Failed to find user'
					});
				} catch (err) {
					warn(err.toString());
				}

				throw new Error(`User "${user}" not found`);
			},

			update: async () => {
				throw new Error('Platform user records can no longer be updated via the SDK.');
			}
		};

		/**
		 * Retrieves activity for an organization or user.
		 * @param {Account} account - The account object.
		 * @param {Object} [params] - Various parameters.
		 * @param {String} [params.from] - The start date in ISO format.
		 * @param {String|Boolean} [params.month] - A month date range. Overrides `to` and `from`.
		 * If `true`, uses current month.
		 * @param {Object|String|Number} [params.org] - The organization object, name, guid, or id.
		 * @param {String} [params.to] - The end date in ISO format.
		 * @param {String} [params.userGuid] - The user guid.
		 * @returns {Promise<Object>}
		 */
		const getActivity = async (account: Account, params: any = {}) => {
			if (params.month !== undefined) {
				Object.assign(params, resolveMonthRange(params.month));
			}

			const { from, to } = resolveDateRange(params.from, params.to);
			let url = '/api/v1/activity?data=true';

			if (params.org) {
				const { id } = this.resolveOrg(account, params.org);
				url += `&org_id=${id}`;
			}

			if (params.userGuid) {
				url += `&user_guid=${params.userGuid}`;
			}

			if (from) {
				url += `&from=${from.toISOString()}`;
			}

			if (to) {
				url += `&to=${to.toISOString()}`;
			}

			return {
				from,
				to,
				events: await this.request(url, account, {
					errorMsg: 'Failed to get user activity'
				})
			};
		};

		/**
		 * Determines team info changes and prepares the team info to be sent.
		 * @param {Object} [info] - The new team info.
		 * @param {Object} [prev] - The previous team info.
		 * @returns {Promise<Object>}
		 */
		const prepareTeamInfo = (info: any = {}, prev?) => {
			if (!info || typeof info !== 'object') {
				throw E.INVALID_ARGUMENT('Expected team info to be an object');
			}

			const changes: any = {};
			const data: any = {};

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
				data.tags = info.tags
					.reduce((arr, tag) => arr.concat(tag.split(',')), [])
					.map(tag => tag.trim());
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
	}

	/**
	 * Returns an Amplify Auth SDK client or creates one if it doesn't exist.
	 * @type {Auth}
	 * @access public
	 */
	get authClient(): Auth {
		try {
			if (!this.#authClient) {
				this.#authClient = new Auth(this.opts);
			}
			return this.#authClient;
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
	 * @param {Account} account - The account object.
	 * @param {Object} [opts] - Various options.
	 * @param {Object} [opts.json] - A JSON payload to send.
	 * @param {String} [opts.method] - The HTTP method to use. If not set, then uses `post` if
	 * `opts.json` is set, otherwise `get`.
	 * @param {String} [opts.resultKey='result'] - The name of the property return from the response.
	 * @returns {Promise} Resolves the JSON-parsed result.
	 * @access private
	 */
	async request(path: string, account: Account, { errorMsg, json, method, resultKey = 'result' } = {} as {
		errorMsg?: string;
		json?: any;
		method?: string;
		resultKey?: string;
	}) {
		try {
			if (!account || typeof account !== 'object') {
				throw new TypeError('Account required');
			}

			const token = account.auth?.tokens?.access_token;
			if (!token) {
				throw new Error('Invalid/expired account');
			}

			const url = `${this.platformUrl || this.env.platformUrl}${path}`;
			const headers: any = {
				Accept: 'application/json',
				Authorization: `Bearer ${token}`
			};

			if (!method) {
				method = json ? 'post' : 'get';
			}

			let response;
			const opts = {
				headers,
				json: json ? JSON.parse(JSON.stringify(json)) : undefined,
				responseType: 'json',
				retry: { limit: 0 }
			};
			let error;

			try {
				log(`${method.toUpperCase()} ${highlight(url)} ${note(`(token ${token}`)}`);
				if (opts.json) {
					log(redact(opts.json, { clone: true }));
				}
				response = await this.got[method](url, opts);
			} catch (e) {
				error = e;
				warn(error);
				if (error.response?.body) {
					warn(error.response.body);
				}
			}

			if (error) {
				throw error;
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
	 * @param {Account} account - The account object.
	 * @param {Organization|String|Number} [org] - The organization object, name, guid, or id.
	 * @returns {Organization} Resolves the org info from the account object.
	 */
	resolveOrg(account: Account, org: Organization | string | number | undefined) {
		if (org && typeof org === 'object' && org.guid) {
			return org;
		}

		if (org === undefined) {
			org = account.org.guid;
		}

		if (typeof org !== 'string' && typeof org !== 'number') {
			throw E.INVALID_ARGUMENT('Expected organization identifier');
		}

		// Check if the criteria matches the account org
		const found = (account.org.guid === org
			|| Number(account.org.id) === Number(org)
			|| account.org.name?.toLowerCase() === String(org).toLowerCase())
			? account.org
			: null;

		if (!found) {
			throw new Error(`Unable to find the organization "${org}"`);
		}

		log(`Resolved org "${org}"${found.name ? ` as ${found.name}` : ''} (${found.id}) ${found.guid}`);

		return found;
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

/**
 * Determines the from and to date range for the specified month or month/year.
 *
 * @param {String|Number|Boolean} month - The month, year and month, or `""`/`true` for current
 * month, to create a date range from.
 * @return {Object}
 */
export function resolveMonthRange(month) {
	const now = new Date();
	let year = now.getUTCFullYear();
	let monthIdx = now.getUTCMonth();
	let monthInt = monthIdx + 1;

	if (typeof month === 'number') {
		monthIdx = month - 1;
		monthInt = month;
	} else if (month !== true && month !== '') {
		if (typeof month !== 'string') {
			throw E.INVALID_ARGUMENT('Expected month to be in the format YYYY-MM or MM');
		}

		const m = month.match(/^(?:(\d{4})-)?(\d\d?)$/);
		if (!m || !m[2]) {
			throw E.INVALID_ARGUMENT('Expected month to be in the format YYYY-MM or MM');
		}

		if (m[1]) {
			year = parseInt(m[1]);
		}
		monthInt = parseInt(m[2]);
		monthIdx = monthInt - 1;
	}

	// TODO: Just use new Date(year, month, 0).getDate() for the day calculation... like, seriously, what is this.

	const days = [ 31, year % 4 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ];
	if (!days[monthIdx]) {
		throw new RangeError(`Invalid month "${monthInt}"`);
	}

	const monthStr = String(monthIdx + 1).padStart(2, '0');
	return {
		from: `${year}-${monthStr}-01`,
		to: `${year}-${monthStr}-${days[monthIdx]}`
	};
}

interface AmplifyAuthSDK {
	/**
	 * Finds an authenticated account or `null` if not found. If the account is found and
	 * the access token is expired yet the refresh token is still valid or the credentials
	 * are stored, it will automatically get a valid access token.
	 * @param {String} accountName - The account name.
	 * @param {Object} [defaultTeams] - A map of default team guids by org guid.
	 * @param {Boolean} [sanitize] - When `true`, removes sensitive information from the returned account object.
	 * @returns {Promise<Object|null>}
	 */
	find(accountName: string, defaultTeams?: Record<string, string>, sanitize?: boolean): Promise<Awaited<ReturnType<AmplifyAuthSDK['loadSession']>>|null>;

	/**
	 * Retrieves platform session information and mutates the account object.
	 * @param {Account} account - The account object.
	 * @param {Object} [defaultTeams] - A map of default team guids by org guid.
	 * @returns {Promise<Object>}
	 */
	findSession(account: Account, defaultTeams?: Record<string, string>): Promise<Account>;

	/**
	 * Returns a list of all authenticated accounts.
	 * @param {Object} [opts] - Various options.
	 * @param {Object} [opts.defaultTeams] - A map of default team guids by org guid.
	 * @param {String[]} [opts.skip] - A list of account names to skip.
	 * @param {Boolean} [opts.validate] - When `true`, validates each account's session.
	 * @param {Boolean} [opts.sanitize] - When `true`, removes sensitive information from the returned account objects.
	 * @returns {Promise<Object[]>}
	 */
	list(opts?: {
		defaultTeams?: Record<string, string>;
		skip?: string[];
		validate?: boolean;
		sanitize?: boolean;
	}): Promise<Account[]>;

	/**
	 * Enrich an account object with platform session information.
	 * @param {Account} account - The account object.
	 * @param {Object} [defaultTeams] - A map of default team guids by org guid.
	 * @param {Boolean} [sanitize] - When `true`, removes sensitive information from the returned account object.
	 * @returns {Promise<Object>}
	 */
	loadSession(account: Account, defaultTeams?: Record<string, string>, sanitize?: boolean): Promise<Account>;

	/**
	 * Authenticates a client and returns the enriched account object.
	 * @param {Object} opts - Various authentication options to override the defaults set via the `Auth` constructor.
	 * @param {String} opts.clientId - The client id to use for authentication.
	 * @param {String} [opts.secretFile] - The path to the PEM formatted private key used to sign the JWT.
	 * @param {String} [opts.clientSecret] - The client secret to use for authentication.
	 * @param {Boolean} [opts.force=false] - When `true`, forces re-authentication even if already authenticated.
	 * @returns {Promise<Object>} Resolves the account info object.
	 */
	login(opts?: any): ReturnType<AmplifyAuthSDK['loadSession']>;

	/**
	 * Discards an access token and notifies AxwayID to revoke the access token.
	 * @param {Object} [opts] - Various options.
	 * @param {String[]} [opts.accounts] - A list of account names to logout.
	 * @param {Boolean} [opts.all=false] - When `true`, logs out all authenticated accounts.
	 * @param {String} [opts.baseUrl] - The AxwayID base URL to use.
	 */
	logout(opts?: { accounts?: string[]; all?: boolean; baseUrl?: string }): ReturnType<Auth['logout']>;

	/**
	 * Returns AxwayID server information.
	 */
	serverInfo: Auth['serverInfo'];
}

interface AmplifyClientSDK {
	/**
	 * Creates a new service account.
	 * @param {Account} account - The account object.
	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
	 * @param {Object} [opts] - Various options.
	 * @param {String} [opts.desc] - The service account description.
	 * @param {String} opts.name - The service account display name.
	 * @param {String} [opts.publicKey] - The PEM formatted public key.
	 * @param {String[]} [opts.roles] - The list of roles to assign to the service account.
	 * @param {String} [opts.secret] - The service account client secret.
	 * @param {Array<{ guid: string, roles: string[] }>} [opts.teams] - One or more teams to assign the service account to.
	 */
	create(
		account: Account,
		org: object|string|number,
		opts: {
			desc?: string;
			name: string;
			publicKey?: string;
			roles?: string[];
			secret?: string;
			teams?: Array<{ guid: string; roles: string[] }>;
		}
	): Promise<{ org: Organization; client: any }>;

	/**
	 * Finds a service account by guid, client_id, or name.
	 * @param {Account} account - The account object.
	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} term - The service account guid, client_id, or name.
	 */
	find(
		account: Account,
		org: Organization | string | number,
		term: string
	): Promise<{ org: Organization; client: any }>;

	/**
	 * Retrieves a list of all service accounts for the given org.
	 * @param {Account} account - The account object.
	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
	 */
	list(
		account: Account,
		org: Organization | string | number
	): Promise<{ org: Organization; clients: any[] }>;

	/**
	 * Removes a service account.
	 * @param {Account} account - The account object.
	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
	 * @param {Object|String} client - The service account object or client id.
	 */
	remove(
		account: Account,
		org: Organization | string | number,
		client: any
	): Promise<{ client: any; org: Organization }>;

	/**
	 * Resolves a client by name, id, or guid using the specified account.
	 * @param {Account} account - The account object.
	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
	 * @param {Object|String} client - The service account object, client id, or guid.
	 */
	resolveClient(
		account: Account,
		org: Organization | string | number,
		client: any
	): Promise<{ org: Organization; client: any }>;

	/**
	 * Validates a list of teams for the given client.
	 * @param {Account} account - The account object.
	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
	 * @param {Array<{ guid: string, roles: string[] }>} teams - One or more teams to validate.
	 */
	resolveTeams(
		account: Account,
		org: Organization | string | number,
		teams: Array<{ guid: string; roles: string[] }>
	): Promise<Array<{ guid: string; roles: string[] }>>;

	/**
	 * Returns the service account auth type label.
	 * @param {String} type - The service account type.
	 */
	resolveType(type: string): 'Client Secret' | 'Client Certificate' | 'Other';

	/**
	 * Updates an existing service account's information.
	 * @param {Account} account - The account object.
	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
	 * @param {Object} opts - Service account properties.
	 * @param {String} [opts.desc] - The service account description.
	 * @param {String} [opts.name] - The service account display name.
	 * @param {String} [opts.publicKey] - The PEM formatted public key.
	 * @param {String[]} [opts.roles] - The list of roles to assign to the service account.
	 * @param {String} [opts.secret] - The service account client secret.
	 * @param {Array<{ guid: string, roles: string[] }>} [opts.teams] - One or more teams to assign the service account to.
	 */
	update(
		account: Account,
		org: Organization | string | number,
		opts?: {
			client: any;
			desc?: string;
			name?: string;
			publicKey?: string;
			roles?: string[];
			secret?: string;
			teams?: Array<{ guid: string; roles: string[] }>;
		}
	): Promise<{ org: Organization; client: any }>;
}

interface AmplifyEntitlementSDK {
	/**
	 * Retrieves entitlement information for a specific entitlement metric.
	 * @param {Account} account - The account object.
	 * @param {String} metric - The entitlement metric name.
	 */
	find: (account: Account, metric: string) => Promise<any>;
}

interface AmplifyOrgSDK {
	/**
	 * Get activity events for an organization.
	 * @param {Account} account - The account object.
	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
	 * @param {Object} [params] - Various parameters.
	 * @param {String} [params.from] - The start date for the activity query.
	 * @param {String} [params.to] - The end date for the activity query.
	 * @param {String|Boolean} [params.month] - The month to filter activities by. If `true`, uses current month.
	 */
	activity(
		account: Account,
		org: Organization | string | number,
		params?: {
			from?: string;
			to?: string;
			month?: string | boolean;
		}
	): Promise<any>;

	/**
	 * List environments for the organization.
	 * @param {Account} account - The account object.
	 */
	environments(account: Account): Promise<any[]>;

	/**
	 * Fetch a specific organization document.
	 * @param {Account} account - The account object.
	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
	 */
	find(account: Account, org: Organization | string | number): Promise<Organization>;

	/**
	 * List all organizations for the account.
	 * @param {Account} account - The account object.
	 * @param {Object|String|Number} [defaultOrg] - The default organization object, name, id, or guid.
	 * @deprecated service accounts are only ever associated with a single organization. Use account.org instead.
	 */
	list(account: Account, defaultOrg?: object | string | number): Promise<Organization[]>;

	user: {
		/**
		 * Add a user to an organization.
		 * @param {Account} account - The account object.
		 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
		 * @param {String} email - The user email address.
		 * @param {String[]} roles - One or more roles to assign to the user.
		 */
		add(
			account: Account,
			org: Organization | string | number,
			email: string,
			roles: string[]
		): Promise<{ org: Organization; user: any }>;

		/**
		 * Find a user in an organization.
		 * @param {Account} account - The account object.
		 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
		 * @param {String} user - The user email or guid.
		 */
		find(
			account: Account,
			org: Organization | string | number,
			user: string
		): Promise<any>;

		/**
		 * List users in an organization.
		 * @param {Account} account - The account object.
		 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
		 */
		list(
			account: Account,
			org: Organization | string | number
		): Promise<{ org: Organization; users: any[] }>;

		/**
		 * Remove a user from an organization.
		 * @param {Account} account - The account object.
		 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
		 * @param {String} user - The user email or guid.
		 */
		remove(
			account: Account,
			org: Organization | string | number,
			user: string
		): Promise<{ org: Organization; user: any, [key: string]: any }>;

		/**
		 * Update a user's roles in an organization.
		 * @param {Account} account - The account object.
		 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
		 * @param {String} user - The user email or guid.
		 * @param {String[]} roles - One or more roles to assign to the user.
		 */
		update(
			account: Account,
			org: Organization | string | number,
			user: string,
			roles: string[]
		): Promise<{ org: Organization; user: any; roles: string[] }>;
	};

	/**
	 * Rename an organization.
	 * @param {Account} account - The account object.
	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} name - The new organization name.
	 */
	rename(
		account: Account,
		org: Organization | string | number,
		name: string
	): Promise<{ oldName: string; [key: string]: any }>;

	/**
	 * Get usage metrics for an organization.
	 * @param {Account} account - The account object.
	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
	 * @param {Object} [params] - Various parameters.
	 * @param {String} [params.from] - The start date for the usage data.
	 * @param {String} [params.to] - The end date for the usage data.
	 * @param {String|Boolean} [params.month] - The month to filter usage by. If `true`, uses current month.
	 */
	usage(
		account: Account,
		org: Organization | string | number,
		params?: {
			from?: string;
			to?: string;
			month?: string | boolean;
		}
	): Promise<{ from: Date; to: Date; [key: string]: any }>;
}

interface AmplifyRoleSDK {
	/**
	 * Retrieves a list of roles, optionally filtered by parameters.
	 * @param {Account} account - The account context.
	 * @param {Object} [params] - Optional filters for roles.
	 * @param {Boolean} [params.default] - When `true`, only returns default roles.
	 * @param {Object|String|Number} [params.org] - The organization object, name, id, or guid to filter roles in context of.
	 * @param {Boolean} [params.team] - When `true`, only returns team roles.
	 */
	list(
		account: Account,
		params?: {
			default?: boolean;
			org?: object | string | number;
			team?: boolean;
		}
	): Promise<any[]>;

	/**
	 * Validates and resolves a list of role identifiers against allowed roles.
	 * @param {Account} account - The account context.
	 * @param {String[]} roles - One or more role identifiers to resolve.
	 * @param {Object} opts - Various options.
	 * @param {Boolean} [opts.default] - When `true`, includes default roles in the allowed roles.
	 * @param {Object|String|Number} [opts.org] - The organization object, name, id, or guid to resolve roles in context of.
	 * @param {Boolean} [opts.requireRoles] - When `true`, throws an error if any roles cannot be resolved.
	 * @param {Boolean} [opts.requireDefaultRole] - When `true`, throws an error if no default role is included.
	 * @param {Boolean} [opts.team] - When `true`, includes team roles in the allowed roles.
	 */
	resolve(
		account: Account,
		roles: string[],
		opts: {
			default?: boolean;
			org?: object | string | number;
			requireRoles?: boolean;
			requireDefaultRole?: boolean;
			team?: boolean;
		}
	): Promise<string[]>;
}

interface AmplifyTeamSDK {
	/**
	 * Create a new team within an organization.
	 * @param {Account} account - The account context.
	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} name - The team name.
	 * @param {Object} [info] - Optional team details.
	 * @param {String} [info.desc] - The team description.
	 * @param {Boolean} [info.default] - When `true`, marks the team as the default team.
	 * @param {String[]} [info.tags] - One or more tags to assign to the team.
	 */
	create(
		account: Account,
		org: Organization | string | number,
		name: string,
		info?: {
			desc?: string;
			default?: boolean;
			tags?: string[];
		}
	): Promise<{ org: Organization; team: any }>;

	/**
	 * Retrieve a team by name or guid.
	 * @param {Account} account - The account context.
	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} team - The team name or guid.
	 */
	find(
		account: Account,
		org: Organization | string | number,
		team: string
	): Promise<{ org: Organization; team: any }>;

	/**
	 * List all teams in an organization, optionally filtered by user guid.
	 * @param {Account} account - The account context.
	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} [user] - When specified, only returns teams that the user belongs to.
	 */
	list(
		account: Account,
		org: Organization | string | number,
		user?: string
	): Promise<{ org: Organization; teams: any[] }>;

	user: {
		/**
		 * Add a user to a team.
		 * @param {Account} account - The account context.
	 	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
		 * @param {String} team - Team name or guid.
		 * @param {String} user - User email or guid.
		 * @param {String[]} roles - Roles to assign.
		 */
		add(
			account: Account,
			org: Organization | string | number,
			team: string,
			user: string,
			roles: string[]
		): Promise<{ org: Organization; team: any; user: any }>;

		/**
		 * Find a user in a team.
		 * @param {Account} account - The account context.
	 	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
		 * @param {String} team - Team name or guid.
		 * @param {String} user - User email or guid.
		 */
		find(
			account: Account,
			org: Organization | string | number,
			team: string,
			user: string
		): Promise<{ org: Organization; team: any; user: any }>;

		/**
		 * List users in a team.
		 * @param {Account} account - The account context.
	 	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
		 * @param {String} team - Team name or guid.
		 */
		list(
			account: Account,
			org: Organization | string | number,
			team: string
		): Promise<{ org: Organization; team: any; users: any[] }>;

		/**
		 * Remove a user from a team.
		 * @param {Account} account - The account context.
	 	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
		 * @param {String} team - Team name or guid.
		 * @param {String} user - User email or guid.
		 */
		remove(
			account: Account,
			org: Organization | string | number,
			team: string,
			user: string
		): Promise<{ org: Organization; team: any; user: any }>;

		/**
		 * Update a user's roles in a team.
		 * @param {Account} account - The account context.
	 	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
		 * @param {String} team - Team name or guid.
		 * @param {String} user - User email or guid.
		 * @param {String[]} roles - Roles to assign.
		 */
		update(
			account: Account,
			org: Organization | string | number,
			team: string,
			user: string,
			roles: string[]
		): Promise<{ org: Organization; team: any; user: any; roles: string[] }>;
	};

	/**
	 * Remove a team from an organization.
	 * @param {Account} account - The account context.
	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} team - Team name or guid.
	 */
	remove(
		account: Account,
		org: Organization | string | number,
		team: string
	): Promise<{ org: Organization; team: any }>;

	/**
	 * Update team details.
	 * @param {Account} account - The account context.
	 * @param {Organization|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} team - Team name or guid.
	 * @param {Object} [info] - Optional team details to update.
	 * @param {String} [info.desc] - The team description.
	 * @param {Boolean} [info.default] - When `true`, marks the team as the default team.
	 * @param {String[]} [info.tags] - One or more tags to assign to the team.
	 */
	update(
		account: Account,
		org: Organization | string | number,
		team: string,
		info?: {
			desc?: string;
			default?: boolean;
			tags?: string[];
			name?: string;
			[key: string]: any;
		}
	): Promise<{ changes: any; org: Organization; team: any }>;
}

interface AmplifyUserSDK {
	/**
	 * Retrieves an account's user's activity.
	 * Throws an error since user activity retrieval is deprecated.
	 * @deprecated
	 */
	activity(): Promise<never>;

	/**
	 * Looks up a user by email, guid, or user object.
	 * @param {Account} account - The account object.
	 * @param {String|Object} user - The user email, guid, or user object.
	 */
	find(account: Account, user: string | { guid: string }): Promise<any>;

	/**
	 * Updates an account's user's information.
	 * Throws an error since updating user records is deprecated.
	 * @deprecated
	 */
	update(): Promise<never>;
}
