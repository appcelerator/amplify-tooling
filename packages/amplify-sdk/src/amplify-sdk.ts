/* eslint-disable promise/no-nesting */

import AmplifySDKActivity from './sdk/activity.js';
import AmplifySDKAuth from './sdk/auth.js';
import AmplifySDKClient from './sdk/client.js';
import AmplifySDKEntitlement from './sdk/entitlement.js';
import AmplifySDKOrg from './sdk/org.js';
import AmplifySDKRole from './sdk/role.js';
import AmplifySDKTeam from './sdk/team.js';
import AmplifySDKUser from './sdk/user.js';
import E from './errors.js';
import fs from 'fs-extra';
import path from 'path';
import setCookie from 'set-cookie-parser';
import snooplogg from 'snooplogg';
import * as environments from './environments.js';
import * as request from '@axway/amplify-request';
import { Account, AmplifySDKOptions } from './types.js';
import { fileURLToPath } from 'url';
import { Got, HTTPAlias, OptionsOfJSONResponseBody } from 'got/dist/source/types.js';
import { redact } from '@axway/amplify-utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { log, warn } = snooplogg('amplify-sdk');
const { highlight, note } = snooplogg.styles;

/**
 * An SDK for accessing Amplify API's.
 */
export default class AmplifySDK {
	activity: AmplifySDKActivity;
	auth: AmplifySDKAuth;
	client: AmplifySDKClient;
	env: environments.EnvironmentInfo;
	entitlement: AmplifySDKEntitlement;
	got: Got;
	opts: AmplifySDKOptions;
	org: AmplifySDKOrg;
	platformUrl?: string;
	role: AmplifySDKRole;
	team: AmplifySDKTeam;
	user: AmplifySDKUser;
	userAgent: string;

	/**
	 * Initializes the environment and SDK's API.
	 *
	 * @param {Object} opts - Authentication options.
	 * @param {Object} [opts.env=prod] - The environment name.
	 * @param {Object} [opts.requestOptions] - HTTP request options with proxy settings and such to
	 * create a `got` HTTP client.
	 * @access public
	 */
	constructor(opts: AmplifySDKOptions = {}) {
		if (typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		/**
		 * Authentication options including clientID, env, realm, and token store settings.
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

		/**
		 * The `got` HTTP client.
		 * @type {Function}
		 */
		this.got = request.init(opts.requestOptions) as any;
		if (!opts.got) {
			opts.got = this.got;
		}

		/**
		 * The platform URL.
		 * @type {String}
		 */
		this.platformUrl = (opts.platformUrl || this.env.platformUrl || '').replace(/\/$/, '') || undefined;

		const { version } = fs.readJsonSync(path.resolve(__dirname, '../package.json'));

		/**
		 * The Axway ID realm.
		 *
		 * IMPORTANT! Platform explicitly checks this user agent, so do NOT change the name or case.
		 *
		 * @type {String}
		 */
		this.userAgent = `AMPLIFY SDK/${version} (${process.platform}; ${process.arch}; node:${process.versions.node})${process.env.AXWAY_CLI ? ` Axway CLI/${process.env.AXWAY_CLI}` : ''}`;

		this.activity    = new AmplifySDKActivity(this);
		this.auth        = new AmplifySDKAuth(this, {
			baseUrl:     (opts.baseUrl || this.env.baseUrl || '').replace(/\/$/, '') || undefined,
			platformUrl: this.platformUrl,
			realm:       opts.realm || this.env.realm
		});
		this.client      = new AmplifySDKClient(this);
		this.entitlement = new AmplifySDKEntitlement(this);
		this.org         = new AmplifySDKOrg(this);
		this.role        = new AmplifySDKRole(this);
		this.team        = new AmplifySDKTeam(this);
		this.user        = new AmplifySDKUser(this);
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
	async request(path: string, account: Account, opts: {
		errorMsg?: string,
		isToolingAuth?: boolean,
		json?: any,
		method?: string,
		resultKey?: string
	} = {}) {
		let { errorMsg, isToolingAuth, json, method, resultKey = 'result' } = opts;
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
			const headers: { [key: string]: string } = {
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

			let response: any;
			const opts = {
				headers,
				json: json ? JSON.parse(JSON.stringify(json)) : undefined,
				responseType: 'json',
				retry: { limit: 0 }
			};
			let error;

			try {
				log(`${method.toUpperCase()} ${highlight(url)} ${note(`(${account.sid ? `sid ${account.sid}` : `token ${token}`})`)}`);
				if (json) {
					log(redact(json, { clone: true }));
				}
				response = await this.got[method as HTTPAlias](url, opts as OptionsOfJSONResponseBody);
			} catch (e: any) {
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
						response = await this.got[method as HTTPAlias](url, opts as OptionsOfJSONResponseBody);
					} catch (err: any) {
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
				await this.auth.client.updateAccount(account);
			}

			return response.body?.[resultKey];
		} catch (err: any) {
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
