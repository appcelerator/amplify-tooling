/* eslint-disable promise/no-nesting */

import Auth from './auth';
import crypto from 'crypto';
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
import { promisify } from 'util';
import { redact } from '@axway/amplify-utils';

const { error, log, warn } = snooplogg('amplify-sdk');
const { highlight, note } = snooplogg.styles;

/**
 * An SDK for accessing Amplify API's.
 */
export default class AmplifySDK {
	/**
	 * Initializes the environment and SDK's API.
	 *
	 * @param {Object} opts - Authentication options.
	 * @param {Object} [opts.env=prod] - The environment name.
	 * @param {Object} [opts.requestOptions] - HTTP request options with proxy settings and such to
	 * create a `got` HTTP client.
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
		this.opts = { ...opts };
		delete this.opts.username;
		delete this.opts.password;

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
		if (!opts.got) {
			opts.got = this.got;
		}

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
		 *
		 * IMPORTANT! Platform explicitly checks this user agent, so do NOT change the name or case.
		 *
		 * @type {String}
		 */
		this.userAgent = `AMPLIFY SDK/${version} (${process.platform}; ${process.arch}; node:${process.versions.node})${process.env.AXWAY_CLI ? ` Axway CLI/${process.env.AXWAY_CLI}` : ''}`;

		this.auth = {
			/**
			 * Finds an authenticated account or `null` if not found. If the account is found and
			 * the access token is expired yet the refresh token is still valid, it will
			 * automatically get a valid access token.
			 * @param {String} accountName - The name of the account including the client id prefix.
			 * @param {Object} [defaultTeams] - A map of account hashes to their selected team guid.
			 * @returns {Promise<Object>} Resolves the account info object.
			 */
			find: async (accountName, defaultTeams) => {
				const account = await this.authClient.find(accountName);
				return account ? await this.auth.loadSession(account, defaultTeams) : null;
			},

			/**
			 * Retrieves platform session information such as the organizations, then mutates the
			 * account object and returns it.
			 * @param {Object} account - The account object.
			 * @param {Object} [defaultTeams] - A map of account hashes to their selected team guid.
			 * @returns {Promise<Object>} Resolves the original account info object.
			 */
			findSession: async (account, defaultTeams) => {
				if (defaultTeams && typeof defaultTeams !== 'object') {
					throw E.INVALID_ARGUMENT('Expected default teams to be an object');
				}

				const result = await this.request('/api/v1/auth/findSession', account, {
					errorMsg: 'Failed to find session'
				});
				account.isPlatform = !!result;

				const populateOrgs = (org, orgs) => {
					account.org = {
						entitlements: Object
							.entries(org.entitlements || {})
							.reduce((obj, [ name, value ]) => {
								if (name[0] !== '_') {
									obj[name] = value;
								}
								return obj;
							}, {}),
						guid:          org.guid,
						id:            org.org_id,
						name:          org.name,
						region:        org.region,
						subscriptions: org.subscriptions || [],
						teams:         []
					};

					account.orgs = orgs.map(({ guid, name, org_id }) => ({
						default: org_id === org.org_id,
						guid,
						id: org_id,
						name
					}));
				};

				if (result) {
					const { org, orgs, role, roles, user } = result;
					populateOrgs(org, orgs);

					account.role = role;
					account.roles = roles;

					account.user = Object.assign({}, account.user, {
						axwayId:      user.axway_id,
						dateJoined:   user.date_activated,
						email:        user.email,
						firstname:    user.firstname,
						guid:         user.guid,
						lastname:     user.lastname,
						organization: user.organization,
						phone:        user.phone
					});
				} else if (account.org?.id) {
					const org = await this.org.find(account, account.org.guid);
					org.org_id = org.org_id || org.id;
					populateOrgs(org, [ org ]);
				}

				account.team = undefined;

				if (account.user.guid) {
					const { teams } = await this.team.list(account, account.org?.id, account.user.guid);
					account.org.teams = teams;

					const selectedTeamGuid = defaultTeams?.[account.hash];

					if (teams.length) {
						const team = teams.find(t => (selectedTeamGuid && t.guid === selectedTeamGuid) || (!selectedTeamGuid && t.default)) || teams[0];
						account.team = {
							default: team.default,
							guid:    team.guid,
							name:    team.name,
							roles:   account.user.guid && team.users?.find(u => u.guid === account.user.guid)?.roles || [],
							tags:    team.tags
						};
					}
				}

				return account;
			},

			/**
			 * Returns a list of all authenticated accounts.
			 * @param {Object} [opts] - Various options.
			 * @param {Object} [opts.defaultTeams] - A map of account hashes to their selected team guid.
			 * @param {Array.<String>} [opts.skip] - A list of accounts to skip validation for.
			 * @param {Boolean} [opts.validate] - When `true`, checks to see if each account has an
			 * active access token and session.
			 * @returns {Promise<Array>}
			 */
			list: async (opts = {}) => {
				if (!opts || typeof opts !== 'object') {
					throw E.INVALID_ARGUMENT('Expected options to be an object');
				}

				return this.authClient.list()
					.then(accounts => accounts.reduce((promise, account) => {
						return promise.then(async list => {
							if (opts.validate && (!opts.skip || !opts.skip.includes(account.name))) {
								try {
									account = await this.auth.find(account.name, opts.defaultTeams);
								} catch (err) {
									warn(`Failed to load session for account "${account.name}": ${err.toString()}`);
								}
							}
							if (account?.auth) {
								delete account.auth.clientSecret;
								delete account.auth.password;
								delete account.auth.secret;
								delete account.auth.username;
								list.push(account);
							}
							return list;
						});
					}, Promise.resolve([])))
					.then(list => list.sort((a, b) => a.name.localeCompare(b.name)));
			},

			/**
			 * Populates the specified account info object with a dashboard session id and org
			 * information.
			 * @param {Object} account - The account object.
			 * @param {Object} [defaultTeams] - A map of account hashes to their selected team guid.
			 * @returns {Promise<Object>} Resolves the original account info object.
			 */
			loadSession: async (account, defaultTeams) => {
				try {
					// grab the org guid before findSession clobbers it
					const { guid } = account.org;

					account = await this.auth.findSession(account, defaultTeams);

					// validate the service account
					if (account.isPlatformTooling) {
						const filteredOrgs = account.orgs.filter(o => o.guid === guid);
						if (!filteredOrgs.length) {
							error(`Service account belongs to org "${guid}", but platform account belongs to:\n${account.orgs.map(o => `  "${o.guid}"`).join('\n')}`);
							throw new Error('The service account\'s organization does not match the specified platform account\'s organizations');
						}
						account.orgs = filteredOrgs;
					}
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

				if (account.isPlatform) {
					log(`Current org: ${highlight(account.org.name)} ${note(`(${account.org.guid})`)}`);
					log('Available orgs:');
					for (const org of account.orgs) {
						log(`  ${highlight(org.name)} ${note(`(${org.guid})`)}`);
					}
				}

				delete account.auth.clientSecret;
				delete account.auth.password;
				delete account.auth.secret;
				delete account.auth.username;

				return account;
			},

			/**
			 * Authenticates a user, retrieves the access tokens, populates the session id and
			 * org info, and returns it.
			 * @param {Object} opts - Various authentication options to override the defaults set
			 * via the `Auth` constructor.
			 * @param {String} [opts.password] - The platform tooling password used to
			 * authenticate. Requires a `username` and `clientSecret` or `secretFile`.
			 * @param {String} [opts.secretFile] - The path to the PEM formatted private key used
			 * to sign the JWT.
			 * @param {String} [opts.username] - The platform tooling username used to
			 * authenticate. Requires a `password` and `clientSecret` or `secretFile`.
			 * @returns {Promise<Object>} Resolves the account info object.
			 */
			login: async (opts = {}) => {
				let account;

				// validate the username/password
				const { password, username } = opts;
				if (username || password) {
					const clientSecret = opts.clientSecret || this.opts.clientSecret;
					const secretFile   = opts.secretFile || this.opts.secretFile;
					if (!clientSecret && !secretFile) {
						throw new Error('Username/password can only be specified when using client secret or secret file');
					}
					if (!username || typeof username !== 'string') {
						throw new TypeError('Expected username to be an email address');
					}
					if (!password || typeof password !== 'string') {
						throw new TypeError('Expected password to be a non-empty string');
					}
					delete opts.username;
					delete opts.password;
				}

				// check if already logged in
				if (!opts?.force) {
					account = await this.authClient.find(opts);
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

				// do the login
				account = await this.authClient.login(opts);

				// if we're in manual mode (e.g. --no-launch-browser), then return now
				if (opts.manual) {
					// account is actually an object containing `cancel`, `promise`, and `url`
					return account;
				}

				try {
					// upgrade the service account with the platform tooling account
					if (username && password) {
						// request() will set the sid and update the account in the token store
						await this.request('/api/v1/auth/login', account, {
							errorMsg: 'Failed to authenticate',
							isToolingAuth: true,
							json: {
								from: 'cli',
								username,
								password
							}
						});

						account.isPlatformTooling = true;
					}

					return await this.auth.loadSession(account);
				} catch (err) {
					// something happened, revoke the access tokens we just got and rethrow
					await this.authClient.logout({
						accounts: [ account.name ],
						baseUrl: this.baseUrl
					});
					throw err;
				}
			},

			/**
			 * Discards an access token and notifies AxwayID to revoke the access token.
			 * @param {Object} opts - Various authentication options to override the defaults set
			 * via the `Auth` constructor.
			 * @param {Array.<String>} opts.accounts - A list of accounts names.
			 * @param {Boolean} opts.all - When `true`, revokes all accounts.
			 * @param {String} [opts.baseUrl] - The base URL used to filter accounts.
			 * @param {Function} [opts.onOpenBrowser] - A callback when the web browser is about to
			 * be launched.
			 * @returns {Promise<Object>} Resolves a list of revoked credentials.
			 */
			logout: async ({ accounts, all, baseUrl = this.baseUrl } = {}) => {
				if (all) {
					accounts = await this.authClient.list();
				} else {
					if (!Array.isArray(accounts)) {
						throw E.INVALID_ARGUMENT('Expected accounts to be a list of accounts');
					}
					if (!accounts.length) {
						return [];
					}
					accounts = (await this.authClient.list()).filter(account => accounts.includes(account.name));
				}

				for (const account of accounts) {
					if (account.isPlatform && !account.isPlatformTooling) {
						// note: there should only be 1 platform account in the accounts list
						const { platformUrl } = environments.resolve(account.auth.env);
						const { logout } = getEndpoints({ baseUrl: account.auth.baseUrl, realm: account.auth.realm });
						const redirect = `${logout}?redirect_uri=${platformUrl}/signed.out?msg=signout`;
						const url = `${platformUrl}/api/v1/auth/logout?redirect=${encodeURIComponent(redirect)}`;
						if (typeof opts.onOpenBrowser === 'function') {
							await opts.onOpenBrowser({ url });
						}
						try {
							await open(url);
						} catch (err) {
							const m = err.message.match(/Exited with code (\d+)/i);
							throw m ? new Error(`Failed to open web browser (code ${m[1]})`) : err;
						}
					}
				}

				return await this.authClient.logout({ accounts: accounts.map(account => account.hash), baseUrl });
			},

			/**
			 * Returns AxwayID server information.
			 * @param {Object} opts - Various authentication options to override the defaults set
			 * via the `Auth` constructor.
			 * @returns {Promise<object>}
			 */
			serverInfo: opts => this.authClient.serverInfo(opts),

			/**
			 * Switches your current organization.
			 * @param {Object} [account] - The account object. Note that this object reference will
			 * be updated with new org info.
			 * @param {Object|String|Number} [org] - The organization object, name, guid, or id.
			 * @param {Object} [opts] - Various options.
			 * @param {Function} [opts.onOpenBrowser] - A callback when the web browser is about to
			 * be launched.
			 * @returns {Promise<Object>} Resolves the updated account object.
			 */
			switchOrg: async (account, org, opts = {}) => {
				if (!account || account.auth.expired) {
					log(`${account ? 'Account is expired' : 'No account specified'}, doing login`);
					account = await this.authClient.login();
				} else {
					try {
						org = this.resolvePlatformOrg(account, org);
					} catch (err) {
						if (err.code !== 'ERR_INVALID_ACCOUNT' && err.code !== 'ERR_INVALID_PLATFORM_ACCOUNT' && err.code !== 'ERR_INVALID_ARGUMENT') {
							// probably org not found
							throw err;
						}
						org = undefined;
					}

					log(`Switching ${highlight(account.name)} to org ${highlight(org.name)} (${org.guid})`);

					const server = new Server();
					const { start, url: redirect } = await server.createCallback((req, res) => {
						log(`Telling browser to redirect to ${highlight(this.platformUrl)}`);
						res.writeHead(302, {
							Location: this.platformUrl
						});
						res.end();
					});

					try {
						const url = createURL(`${this.platformUrl}/#/auth/org.select`, {
							org_id: org?.id,
							redirect
						});
						log(`Launching default web browser: ${highlight(url)}`);
						if (typeof opts.onOpenBrowser === 'function') {
							await opts.onOpenBrowser({ url });
						}
						try {
							await open(url);
						} catch (err) {
							const m = err.message.match(/Exited with code (\d+)/i);
							throw m ? new Error(`Failed to open web browser (code ${m[1]})`) : err;
						}

						log(`Waiting for browser to be redirected to: ${highlight(redirect)}`);
						await start();
						account = await this.authClient.createAuthenticator(this.authClient.applyDefaults()).getToken(undefined, undefined, true);
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

		this.client = {
			/**
			 * Creates a new service account.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, id, or guid.
			 * @param {Object} opts - Various options.
			 * @param {String} [opts.desc] - The service account description.
			 * @param {String} opts.name - The display name.
			 * @param {String} [opts.publicKey] - A PEM formatted public key.
			 * @param {Array<String>} [opts.roles] - A list of roles to assign to the service account.
			 * @param {String} [opts.secret] - A client secret key.
			 * @param {Array<Object>} [opts.teams] - A list of objects containing `guid` and `roles`
			 * properties.
			 * @returns {Promise<Object>}
			 */
			create: async (account, org, opts = {}) => {
				org = this.resolvePlatformOrg(account, org);

				if (!opts || typeof opts !== 'object') {
					throw E.INVALID_ARGUMENT('Expected options to be an object');
				}

				if (!opts.name || typeof opts.name !== 'string') {
					throw E.INVALID_ARGUMENT('Expected name to be a non-empty string');
				}

				if (opts.desc && typeof opts.desc !== 'string') {
					throw E.INVALID_ARGUMENT('Expected description to be a string');
				}

				const data = {
					name:        opts.name,
					description: opts.desc || '',
					org_guid:    org.guid
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
					data.roles = await this.role.resolve(account, opts.roles, { client: true, org });
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

			/**
			 * Finds a service account by client id.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, id, or guid.
			 * @param {String} clientId - The service account's client id.
			 * @returns {Promise<Object>}
			 */
			find: async (account, org, clientId) => {
				assertPlatformAccount(account);

				const { clients } = await this.client.list(account, org);

				// first try to find the service account by guid, then client id, then name
				let client = clients.find(c => c.guid === clientId);
				if (!client) {
					client = clients.find(c => c.client_id === clientId);
				}
				if (!client) {
					client = clients.find(c => c.name === clientId);
				}

				// if still not found, error
				if (!client) {
					throw new Error(`Service account "${clientId}" not found`);
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

			/**
			 * Generates a new public/private key pair.
			 * @returns {Promise<Object>} Resolves an object with `publicKey` and `privateKey` properties.
			 */
			async generateKeyPair() {
				return await promisify(crypto.generateKeyPair)('rsa', {
					modulusLength: 2048,
					publicKeyEncoding: { type: 'spki', format: 'pem' },
					privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
				});
			},

			/**
			 * Retrieves a list of all service accounts for the given org.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, id, or guid.
			 * @returns {Promise<Object>} Resolves the service account that was removed.
			 */
			list: async (account, org) => {
				org = this.resolvePlatformOrg(account, org);
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

			/**
			 * Removes a service account.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, id, or guid.
			 * @param {Object|String} client - The service account object or client id.
			 * @returns {Promise<Object>} Resolves the service account that was removed.
			 */
			remove: async (account, org, client) => {
				client = await this.client.resolveClient(account, org, client);

				await this.request(`/api/v1/client/${client.client_id}`, account, {
					errorMsg: 'Failed to remove service account',
					method: 'delete'
				});

				return { client, org };
			},

			/**
			 * Resolves an org by name, id, org guid using the specified account.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, guid, or id.
			 * @param {Object|String} client - The service account object or client id.
			 * @returns {Promise<Object>}
			 */
			resolveClient: async (account, org, client) => {
				if (client && typeof client === 'object' && client.client_id) {
					return client;
				}

				if (client && typeof client === 'string') {
					return (await this.client.find(account, org, client)).client;
				}

				throw E.INVALID_ARGUMENT('Expected client to be an object or client id');
			},

			/**
			 * Validates a list of teams for the given org.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, id, or guid.
			 * @param {Array<Object>} [teams] - A list of objects containing `guid` and `roles`
			 * properties.
			 * @returns {Array<String>} An aray of team guids.
			 */
			resolveTeams: async (account, org, teams) => {
				if (!Array.isArray(teams)) {
					throw E.INVALID_ARGUMENT('Expected teams to be an array');
				}

				if (!teams.length) {
					return;
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

			/**
			 * Returns the service account auth type label.
			 * @param {String} type - The auth type.
			 * @returns {String}
			 */
			resolveType(type) {
				return type === 'secret' ? 'Client Secret' : type === 'certificate' ? 'Client Certificate' : 'Other';
			},

			/**
			 * Updates an existing service account's information.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, id, or guid.
			 * @param {Object} opts - Various options.
			 * @param {Object|String} opts.client - The service account object or client id.
			 * @param {String} [opts.desc] - The service account description.
			 * @param {String} [opts.name] - The display name.
			 * @param {String} [opts.publicKey] - A PEM formatted public key.
			 * @param {Array<String>} [opts.roles] - A list of roles to assign to the service account.
			 * @param {String} [opts.secret] - A client secret key.
			 * @param {Array<Object>} [opts.teams] - A list of objects containing `guid` and `roles`
			 * properties.
			 * @returns {Promise}
			 */
			update: async (account, org, opts = {}) => {
				org = this.resolvePlatformOrg(account, org);

				if (!opts || typeof opts !== 'object') {
					throw E.INVALID_ARGUMENT('Expected options to be an object');
				}

				const client = await this.client.resolveClient(account, org, opts.client);
				const data = {};

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
					data.roles = !opts.roles ? [] : await this.role.resolve(account, opts.roles, { client: true, org });
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
			/**
			 * Retrieves entitlement information for a specific entitlement metric.
			 * @param {Object} account - The account object.
			 * @param {String} metric - The entitlement metric name.
			 * @returns {Promise<Object>}
			 */
			find: (account, metric) => this.request(`/api/v1/entitlement/${metric}`, account, {
				errorMsg: 'Failed to get entitlement info'
			})
		};

		/**
		 * Retrieves activity for an organization or user.
		 * @param {Object} account - The account object.
		 * @param {Object} [params] - Various parameters.
		 * @param {String} [params.from] - The start date in ISO format.
		 * @param {String|Boolean} [params.month] - A month date range. Overrides `to` and `from`.
		 * If `true`, uses current month.
		 * @param {Object|String|Number} [params.org] - The organization object, name, guid, or id.
		 * @param {String} [params.to] - The end date in ISO format.
		 * @param {String} [params.userGuid] - The user guid.
		 * @returns {Promise<Object>}
		 */
		const getActivity = async (account, params = {}) => {
			assertPlatformAccount(account);

			if (params.month !== undefined) {
				Object.assign(params, resovleMonthRange(params.month));
			}

			let { from, to } = resolveDateRange(params.from, params.to);
			let url = '/api/v1/activity?data=true';

			if (params.org) {
				const { id } = this.resolvePlatformOrg(account, params.org);
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

		this.org = {
			/**
			 * Retieves organization activity.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, guid, or id.
			 * @param {Object} [params] - Various parameters.
			 * @param {String} [params.from] - The start date in ISO format.
			 * @param {String|Boolean} [params.month] - A month date range. Overrides `to` and
			 * `from`. If `true`, uses current month.
			 * @param {String} [params.to] - The end date in ISO format.
			 * @returns {Promise<Object>}
			 */
			activity: (account, org, params) => getActivity(account, {
				...params,
				org
			}),

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
				const { id } = this.resolvePlatformOrg(account, org);
				return await this.request(`/api/v1/org/${id}/family`, account, {
					errorMsg: 'Failed to get organization family'
				});
			},

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

				const { teams } = await this.team.list(account, id);

				const result = {
					active:           org.active,
					created:          org.created,
					childOrgs:        null, // deprecated
					guid:             org.guid,
					id:               id,
					name:             org.name,
					entitlements:     org.entitlements,
					parentOrg:        null, // deprecated
					region:           org.region,
					insightUserCount: ~~org.entitlements.limit_read_only_users,
					seats:            org.entitlements.limit_users === 10000 ? null : org.entitlements.limit_users,
					subscriptions,
					teams,
					teamCount:        teams.length,
					userCount:        org.users.length,
					userRoles:        org.users.find(u => u.guid === account.user.guid)?.roles || []
				};

				if (org.entitlements?.partners) {
					for (const partner of org.entitlements.partners) {
						result[partner] = org[partner];
					}
				}

				return result;
			},

			/**
			 * Retrieves the list of orgs from the specified account.
			 * @param {Object} account - The account object.
			 * @param {String} defaultOrg - The name, id, or guid of the default organization.
			 * @returns {Promise<Array>}
			 */
			list: async (account, defaultOrg) => {
				assertPlatformAccount(account);

				const { guid } = this.resolvePlatformOrg(account, defaultOrg);

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
					org = this.resolvePlatformOrg(account, org);
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
					org = this.resolvePlatformOrg(account, org);
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

				/**
				 * Removes an user from an org.
				 * @param {Object} account - The account object.
				 * @param {Object|String|Number} org - The organization object, name, id, or guid.
				 * @param {String} user - The user email or guid.
				 * @returns {Promise<Object>}
				 */
				remove: async (account, org, user) => {
					org = this.resolvePlatformOrg(account, org);
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
					org = this.resolvePlatformOrg(account, org);
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

			/**
			 * Renames an org.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, id, or guid.
			 * @param {String} name - The new organization name.
			 * @returns {Promise<Object>}
			 */
			rename: async (account, org, name) => {
				const { id, name: oldName } = this.resolvePlatformOrg(account, org);

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
			 * Renames an org.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, id, or guid.
			 * @param {Object} [params] - Various parameters.
			 * @param {String} [params.from] - The start date in ISO format.
			 * @param {String|Boolean} [params.month] - A month date range. Overrides `to` and
			 * `from`. If `true`, uses current month.
			 * @param {String} [params.to] - The end date in ISO format.
			 * @returns {Promise<Object>}
			 */
			usage: async (account, org, params = {}) => {
				const { id } = this.resolvePlatformOrg(account, org);

				if (params.month !== undefined) {
					Object.assign(params, resovleMonthRange(params.month));
				}

				const { from, to } = resolveDateRange(params.from, params.to);

				let url = `/api/v1/org/${id}/usage`;
				if (from) {
					url += `?from=${from.toISOString()}`;
				}
				if (to) {
					url += `${from ? '&' : '?'}to=${to.toISOString()}`;
				}

				const results = await this.request(url, account, {
					errorMsg: 'Failed to get organization usage'
				});

				if (results.bundle?.metrics) {
					for (const [ metric, info ] of Object.entries(results.bundle.metrics)) {
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
			/**
			 * Get all roles.
			 * @param {Object} account - The account object.
			 * @param {Object} [params] - Various parameters.
			 * @param {Boolean} [params.default] - When `true`, returns default roles only.
			 * @param {Object|String|Number} [params.org] - The organization object, name, id, or guid.
			 * @param {Boolean} [params.team] - When `true`, returns team specific roles.
			 * @returns {Promise<Object>}
			 */
			list: async (account, params = {}) => {
				let roles = await this.request(
					`/api/v1/role${params.team ? '?team=true' : ''}`,
					account,
					{ errorMsg: 'Failed to get roles' }
				);

				let org = params.org || account.org?.guid;
				if (org) {
					org = await this.org.find(account, org);
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
					roles = roles.filter(r => r.default);
				}

				if (params.team) {
					roles = roles.filter(r => r.team);
				}

				return roles;
			},

			/**
			 * Fetches roles for the given params, then validates the supplied list of roles.
			 * @param {Object} account - The account object.
			 * @param {Array.<String>} roles - One or more roles to assign.
			 * @param {Object} [opts] - Various options.
			 * @param {Boolean} [opts.client] - When `true`, returns client specific roles.
			 * @param {Boolean} [opts.default] - When `true`, returns default roles only.
			 * @param {Object|String|Number} [opts.org] - The organization object, name, id, or guid.
			 * @param {Boolean} [opts.requireRoles] - When `true`, throws an error if roles is empty.
			 * @param {Boolean} [opts.requireDefaultRole] - When `true`, throws an error if roles is empty or if there are no default roles.
			 * @param {Boolean} [opts.team] - When `true`, validates team specific roles.
			 * @returns {Promise<Object>}
			 */
			resolve: async (account, roles, opts) => {
				if (!Array.isArray(roles)) {
					throw E.INVALID_ARGUMENT('Expected roles to be an array');
				}

				if (!roles.length && !opts.requireRoles && !opts.requireDefaultRole) {
					return [];
				}

				const allowedRoles = await this.role.list(account, {
					client:  opts.client,
					default: opts.default,
					org:     opts.org,
					team:    opts.team
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
				org = this.resolvePlatformOrg(account, org);

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

			/**
			 * Find a team by name or guid.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, id, or guid.
			 * @param {String} team - The team name or guid.
			 * @returns {Promise<Object>}
			 */
			find: async (account, org, team) => {
				org = this.resolvePlatformOrg(account, org);

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

			/**
			 * List all teams in an org.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, id, or guid.
			 * @param {String} [user] - A user guid to filter teams
			 * @returns {Promise<Object>}
			 */
			list: async (account, org, user) => {
				org = org && this.resolveOrg(account, org);
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

					roles = await this.role.resolve(account, roles, { org, requireRoles: true, team: true });

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
			 * Removes a team from an organization.
			 * @param {Object} account - The account object.
			 * @param {Object|String|Number} org - The organization object, name, id, or guid.
			 * @param {String} team - The team or guid.
			 * @returns {Promise<Object>}
			 */
			remove: async (account, org, team) => {
				({ org, team } = await this.team.find(account, org, team));

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
				({ org, team } = await this.team.find(account, org, team));

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
			 * @param {String|Boolean} [params.month] - A month date range. Overrides `to` and
			 * `from`. If `true`, uses current month.
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
	 * Returns an Amplify Auth SDK client or creates one if it doesn't exist.
	 * @type {Auth}
	 * @access public
	 */
	get authClient() {
		try {
			if (!this._authClient) {
				this._authClient = new Auth(this.opts);
			}
			return this._authClient;
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
	 * @param {Boolean} [opts.isToolingAuth] - When `true`, bypasses the the no sid/token check.
	 * @param {Object} [opts.json] - A JSON payload to send.
	 * @param {String} [opts.method] - The HTTP method to use. If not set, then uses `post` if
	 * `opts.json` is set, otherwise `get`.
	 * @param {String} [opts.resultKey='result'] - The name of the property return from the response.
	 * @returns {Promise} Resolves the JSON-parsed result.
	 * @access private
	 */
	async request(path, account, { errorMsg, isToolingAuth, json, method, resultKey = 'result' } = {}) {
		try {
			if (!account || typeof account !== 'object') {
				throw new TypeError('Account required');
			}

			const { sid } = account;
			const token = account.auth?.tokens?.access_token;
			if (!sid && !token && !isToolingAuth) {
				throw new Error('Invalid/expired account');
			}

			const url = `${this.platformUrl || this.env.platformUrl}${path}`;
			const headers = {
				Accept: 'application/json',
				'User-Agent': this.userAgent
			};

			if (account.sid) {
				headers.Cookie = `connect.sid=${account.sid}`;
			} else if (token) {
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

			if (error || (path === '/api/v1/auth/findSession' && response.body?.[resultKey] === null)) {
				if ((!error || (error.code && error.code > 400)) && account.sid) {
					// sid is probably bad, try again with the token
					warn('Platform session was invalidated, trying again to reinitialize session with token');
					headers.Authorization = `Bearer ${token}`;
					delete headers.Cookie;
					log(`${method.toUpperCase()} ${highlight(url)} ${note(`(${account.sid ? `sid ${account.sid}` : `token ${token}`})`)}`);
					try {
						response = await this.got[method](url, opts);
					} catch (err) {
						// access token is invalid
						throw E.SESSION_INVALIDATED('Platform session has been invalidated');
					}
				} else if (error) {
					throw error;
				}
			}

			const cookies = response.headers['set-cookie'];
			const connectSid = cookies && setCookie.parse(cookies).find(c => c.name === 'connect.sid')?.value;
			if (connectSid) {
				log(`Setting sid: ${highlight(connectSid)}`);
				account.sid = connectSid;
				await this.authClient.updateAccount(account);
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
			return o.guid?.toLowerCase() === String(org).toLowerCase()
				|| String(o.id) === String(org)
				|| o.name?.toLowerCase() === String(org).toLowerCase();
		});

		if (!found) {
			throw new Error(`Unable to find the organization "${org}"`);
		}

		log(`Resolved org "${org}"${found.name ? ` as ${found.name}` : ''} (${found.id}) ${found.guid}`);

		return found;
	}

	/**
	 * Asserts the account is a platform account, then resolves an org by name, id, org guid using
	 * the specified account.
	 *
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} [org] - The organization object, name, guid, or id.
	 * @returns {Promise<Object>} Resolves the org info from the account object.
	 * @access public
	 */
	resolvePlatformOrg(account, org) {
		assertPlatformAccount(account);
		return this.resolveOrg(account, org);
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

/**
 * Determines the from and to date range for the specified month or month/year.
 *
 * @param {String|Number|Boolean} month - The month, year and month, or `""`/`true` for current
 * month, to create a date range from.
 * @return {Object}
 */
export function resovleMonthRange(month) {
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
