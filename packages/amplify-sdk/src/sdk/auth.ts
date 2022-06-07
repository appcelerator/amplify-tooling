import AmplifySDK from '../amplify-sdk.js';
import Auth, { DefaultOptions, ServerInfo, ServerInfoOptions } from '../auth.js';
import Base from './base.js';
import E from '../errors.js';
import getEndpoints from '../endpoints.js';
import open from 'open';
import Server from '../server.js';
import snooplogg from 'snooplogg';
import * as environments from '../environments.js';
import { Account, DefaultTeams, OrgLike, OrgRef } from '../types.js';
import { createURL } from '../util.js';
import { ManualLoginResult } from '../authenticators/authenticator.js';
import { PlatformSession } from './platform-types.js';

const { error, log, warn } = snooplogg('amplify-sdk:auth');
const { highlight, note } = snooplogg.styles;

export class AlreadyAuthenticatedError extends Error {
	account?: Account | null;
	code?: string;
}

export default class AmplifySDKAuth extends Base {
	baseUrl?: string;
	platformUrl?: string;
	realm?: string;
	_client!: Auth;

	/**
	 * Returns an Amplify Auth SDK client or creates one if it doesn't exist.
	 * @type {Auth}
	 * @access public
	 */
	get client(): Auth {
		try {
			if (!this._client) {
				this._client = new Auth(this.sdk.opts);
			}
			return this._client;
		} catch (err: any) {
			if (err.code === 'ERR_SECURE_STORE_UNAVAILABLE') {
				const isWin = process.platform === 'win32';
				err.message = `Secure token store is not available.\nPlease reinstall the Axway CLI by running:\n    ${isWin ? '' : 'sudo '}npm install --global ${isWin ? '' : '--unsafe-perm '}axway`;
			}
			throw err;
		}
	}

	constructor(sdk: AmplifySDK, params: {
		baseUrl?: string,
		platformUrl?: string,
		realm?: string
	} = {}) {
		super(sdk);
		this.baseUrl     = params.baseUrl;
		this.platformUrl = params.platformUrl;
		this.realm       = params.realm;
	}

	/**
	 * Finds an authenticated account or `null` if not found. If the account is found and
	 * the access token is expired yet the refresh token is still valid, it will
	 * automatically get a valid access token.
	 * @param {String} accountName - The name of the account including the client id prefix.
	 * @param {Object} [defaultTeams] - A map of account hashes to their selected team guid.
	 * @returns {Promise<Object>} Resolves the account info object.
	 */
	async find(accountName: string, defaultTeams?: DefaultTeams): Promise<Account | null> {
		const account = await this.client.find(accountName);
		return account ? await this.loadSession(account, defaultTeams) : null;
	}

	/**
	 * Retrieves platform session information such as the organizations, then mutates the
	 * account object and returns it.
	 * @param {Object} account - The account object.
	 * @param {Object} [defaultTeams] - A map of account hashes to their selected team guid.
	 * @returns {Promise<Object>} Resolves the original account info object.
	 */
	async findSession(account: Account, defaultTeams?: DefaultTeams): Promise<Account> {
		if (defaultTeams && typeof defaultTeams !== 'object') {
			throw E.INVALID_ARGUMENT('Expected default teams to be an object');
		}

		const result: PlatformSession = await this.sdk.request('/api/v1/auth/findSession', account, {
			errorMsg: 'Failed to find session'
		}) as PlatformSession;

		account.isPlatform = !!result;

		if (result) {
			const { org, orgs, role, roles, user } = result;
			account.org = await this.sdk.org.init(account, org);
			account.orgs = orgs.map(org => ({
				guid:   org.guid,
				name:   org.name,
				org_id: org.org_id,
				role:   org.role
			}));
			account.role = role;
			account.roles = roles;

			account.user = {
				...account.user,
				dateJoined:   user.date_activated,
				email:        user.email,
				firstname:    user.firstname,
				guid:         user.guid,
				lastname:     user.lastname
			};
		} else if (account.org?.guid) {
			// we have a service account
			account.org = await this.sdk.org.find(account, account.org.guid);
			account.orgs = [
				{
					guid:   account.org.guid,
					name:   account.org.name,
					org_id: account.org.org_id
				}
			];
		}

		account.team = undefined;

		if (account.user.guid) {
			const { teams } = await this.sdk.team.list(account, account.org, account.user.guid);
			account.org.teams = teams;

			const selectedTeamGuid = defaultTeams?.[account.hash];
			if (teams.length) {
				account.team = teams.find(t => (selectedTeamGuid && t.guid === selectedTeamGuid) || (!selectedTeamGuid && t.default)) || teams[0];
			}
		}

		return account;
	}

	/**
	 * Returns a list of all authenticated accounts.
	 * @param {Object} [opts] - Various options.
	 * @param {Object} [opts.defaultTeams] - A map of account hashes to their selected team guid.
	 * @param {Array.<String>} [opts.skip] - A list of accounts to skip validation for.
	 * @param {Boolean} [opts.validate] - When `true`, checks to see if each account has an
	 * active access token and session.
	 * @returns {Promise<Array>}
	 */
	async list(opts: {
		defaultTeams?: DefaultTeams,
		skip?: string[],
		validate?: boolean
	} = {}): Promise<Account[]> {
		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		const allAccounts: Account[] = await this.client.list();
		const accounts: Account[] = await allAccounts.reduce((promise, account: Account) => {
			return promise.then(async list => {
				let acct: Account | undefined | null = account;
				if (opts.validate && (!opts.skip || (acct.name && !opts.skip.includes(acct.name)))) {
					try {
						acct = await this.find(account.name, opts.defaultTeams);
					} catch (err: any) {
						warn(`Failed to load session for account "${account.name}": ${err.toString()}`);
					}
				}
				if (acct && acct.auth) {
					delete account.auth.clientSecret;
					delete account.auth.password;
					delete account.auth.secret;
					delete account.auth.username;
					list.push(acct);
				}
				return list;
			});
		}, Promise.resolve([] as Account[]));

		return accounts.sort((a: Account, b: Account) => a.name.localeCompare(b.name));
	}

	/**
	 * Populates the specified account info object with a dashboard session id and org
	 * information.
	 * @param {Object} account - The account object.
	 * @param {Object} [defaultTeams] - A map of account hashes to their selected team guid.
	 * @returns {Promise<Object>} Resolves the original account info object.
	 */
	async loadSession(account: Account, defaultTeams?: DefaultTeams): Promise<Account | null> {
		try {
			// grab the org guid before findSession clobbers it
			const { guid } = account.org;

			account = await this.findSession(account, defaultTeams);

			// validate the service account
			if (account.isPlatformTooling) {
				const filteredOrgs = account.orgs.filter(o => o.guid === guid);
				if (!filteredOrgs.length) {
					error(`Service account belongs to org "${guid}", but platform account belongs to:\n${account.orgs.map(o => `  "${o.guid}"`).join('\n')}`);
					throw new Error('The service account\'s organization does not match the specified platform account\'s organizations');
				}
				account.orgs = filteredOrgs;
			}
		} catch (err: any) {
			if (err.code === 'ERR_SESSION_INVALIDATED') {
				warn(`Detected invalidated session, purging account ${highlight(account.name)}`);
				await this.client.logout({
					accounts: [ account.name ],
					baseUrl: this.baseUrl
				});
				return null;
			}
			throw err;
		}

		await this.client.updateAccount(account);

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
	}

	/**
	 * Authenticates a user, retrieves the access tokens, populates the session id and
	 * org info, and returns it.
	 * @param {Object} opts - Various authentication options to override the defaults set
	 * via the `Auth` constructor.
	 * @param {Boolean} [opts.force] - When `true`, skips the already logged in check.
	 * @param {String} [opts.password] - The platform tooling password used to
	 * authenticate. Requires a `username` and `clientSecret` or `secretFile`.
	 * @param {String} [opts.secretFile] - The path to the PEM formatted private key used
	 * to sign the JWT.
	 * @param {String} [opts.username] - The platform tooling username used to
	 * authenticate. Requires a `password` and `clientSecret` or `secretFile`.
	 * @returns {Promise<Object>} Resolves the account info object.
	 */
	async login(opts: DefaultOptions & {
		force?: boolean,
		password?: string,
		secretFile?: string,
		username?: string
	} = {}): Promise<Account | ManualLoginResult | null> {
		let account: Account | ManualLoginResult | null | undefined;

		// validate the username/password
		const { password, username } = opts;
		if (username || password) {
			const clientSecret = opts.clientSecret || this.sdk.opts.clientSecret;
			const secretFile   = opts.secretFile || this.sdk.opts.secretFile;
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
			account = await this.client.find(opts);
			if (account && !account.auth.expired) {
				warn(`Account ${highlight(account.name)} is already authenticated`);
				const err = new AlreadyAuthenticatedError('Account already authenticated');
				err.account = account;
				try {
					err.account = await this.loadSession(account);
				} catch (e: any) {
					warn(e);
				}
				err.code = 'EAUTHENTICATED';
				throw err;
			}
		}

		// do the login
		account = await this.client.login(opts);

		// if we're in manual mode (e.g. --no-launch-browser), then return now
		if (opts.manual) {
			// account is actually an object containing `cancel`, `promise`, and `url`
			return account;
		}

		const acct: Account = account as Account;

		try {
			// upgrade the service account with the platform tooling account
			if (username && password) {
				// request() will set the sid and update the account in the token store
				await this.sdk.request('/api/v1/auth/login', acct, {
					errorMsg: 'Failed to authenticate',
					isToolingAuth: true,
					json: {
						from: 'cli',
						username,
						password
					}
				});

				acct.isPlatformTooling = true;
			}

			return await this.loadSession(acct);
		} catch (err: any) {
			// something happened, revoke the access tokens we just got and rethrow
			await this.client.logout({
				accounts: [ acct.name ],
				baseUrl: this.baseUrl
			});
			throw err;
		}
	}

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
	async logout({ accounts, all, baseUrl, onOpenBrowser }: {
		accounts: string[],
		all?: boolean,
		baseUrl?: string,
		onOpenBrowser?: (p: { url: string }) => void
	}) {
		if (baseUrl === undefined) {
			baseUrl = this.baseUrl;
		}

		let accountList: Account[];

		if (all) {
			accountList = (await this.client.list());
		} else if (!Array.isArray(accounts)) {
			throw E.INVALID_ARGUMENT('Expected accounts to be a list of accounts');
		} else if (!accounts.length) {
			return [];
		} else {
			accountList = (await this.client.list())
				.filter(account => accounts.includes(account.name));
		}

		for (const account of accountList) {
			if (account.isPlatform && !account.isPlatformTooling) {
				// note: there should only be 1 platform account in the accounts list
				const { platformUrl } = environments.resolve(account.auth.env);
				const { logout } = getEndpoints({ baseUrl: account.auth.baseUrl, realm: account.auth.realm });
				const redirect = `${logout}?redirect_uri=${platformUrl}/signed.out?msg=signout`;
				const url = `${platformUrl}/api/v1/auth/logout?redirect=${encodeURIComponent(redirect)}`;
				if (typeof onOpenBrowser === 'function') {
					await onOpenBrowser({ url });
				}
				try {
					await open(url);
				} catch (err: any) {
					const m = err.message.match(/Exited with code (\d+)/i);
					throw m ? new Error(`Failed to open web browser (code ${m[1]})`) : err;
				}
			}
		}

		return await this.client.logout({ accounts: accountList.map(a => a.hash), baseUrl });
	}

	/**
	 * Returns AxwayID server information.
	 * @param {Object} opts - Various authentication options to override the defaults set
	 * via the `Auth` constructor.
	 * @returns {Promise<object>}
	 */
	async serverInfo(opts: ServerInfoOptions): Promise<ServerInfo> {
		return await this.client.serverInfo(opts);
	}

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
	async switchOrg(account: Account, org: OrgLike, opts: {
		onOpenBrowser?: (p: { url: string }) => void
	} = {}): Promise<Account | null> {
		if (!account || account.auth.expired) {
			log(`${account ? 'Account is expired' : 'No account specified'}, doing login`);
			account = await this.client.login() as Account;
		} else {
			let orgRef: OrgRef | undefined;

			try {
				orgRef = this.sdk.org.resolve(account, org, true);
				log(`Switching ${highlight(account.name)} to org ${highlight(orgRef.name)} (${orgRef.guid})`);
			} catch (err: any) {
				if (err.code !== 'ERR_INVALID_ACCOUNT' && err.code !== 'ERR_INVALID_PLATFORM_ACCOUNT' && err.code !== 'ERR_INVALID_ARGUMENT') {
					// probably org not found
					throw err;
				}
				orgRef = undefined;
			}

			const server = new Server();
			const { start, url: redirect } = await server.createCallback(async (req, res) => {
				log(`Telling browser to redirect to ${highlight(this.platformUrl)}`);
				res.writeHead(302, {
					Location: this.platformUrl
				});
				res.end();
			});

			try {
				const url = createURL(`${this.platformUrl}/#/auth/org.select`, {
					org_id: orgRef?.org_id,
					redirect
				});
				log(`Launching default web browser: ${highlight(url)}`);
				if (typeof opts.onOpenBrowser === 'function') {
					await opts.onOpenBrowser({ url });
				}
				try {
					await open(url);
				} catch (err: any) {
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
			return await this.loadSession(account);
		} catch (e: any) {
			// squelch
			log(e);
		}

		throw new Error('Failed to switch organization');
	}
}
