import Base from './base.js';
import E from '../errors.js';
import snooplogg from 'snooplogg';
import {
	Account,
	ActivityParams,
	ActivityResult,
	Entitlements,
	Environment,
	Org,
	OrgLike,
	OrgRef,
	OrgUser,
	Subscription,
	UsageParams,
	UsageResult
} from '../types.js';
import {
	PlatformOrg,
	PlatformOrgEnvironment,
	PlatformOrgPartners,
	PlatformOrgUsage,
	PlatformOrgUser,
	PlatformPartner,
	PlatformSubscription
} from './platform-types.js';
import { resolveDateRange, resolveMonthRange } from '../util.js';

const { log } = snooplogg('amplify-sdk:org');

export default class AmplifySDKOrg extends Base {
	/**
	 * Retieves organization activity.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} [org] - The organization object, name, guid, or id.
	 * @param {Object} [params] - Various parameters.
	 * @param {String} [params.from] - The start date in ISO format.
	 * @param {String|Boolean} [params.month] - A month date range. Overrides `to` and
	 * `from`. If `true`, uses current month.
	 * @param {String} [params.to] - The end date in ISO format.
	 * @returns {Promise<Object>}
	 */
	async activity(account: Account, org?: OrgLike, params?: {
		from?: string,
		month?: string | boolean,
		to?: string
	}): Promise<ActivityResult> {
		return await this.sdk.activity.find(account, {
			...params,
			org
		} as ActivityParams);
	}

	/**
	 * Retrieves organization details for an account.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @returns {Promise<Array>}
	 */
	async find(account: Account, org?: OrgLike): Promise<Org> {
		const { org_id } = this.resolve(account, org);
		const platformOrg = await this.sdk.request(`/api/v1/org/${org_id}`, account, {
			errorMsg: 'Failed to get organization'
		});
		return await this.init(account, platformOrg);
	}

	/**
	 * Retrieves the list of environments associated to the user's org.
	 * @param {Object} account - The account object.
	 * @returns {Promise<Array>}
	 */
	async environments(account: Account): Promise<Environment[]> {
		this.assertPlatformAccount(account);

		const envs: PlatformOrgEnvironment[] = await this.sdk.request('/api/v1/org/env', account, {
			errorMsg: 'Failed to get organization environments'
		});

		return envs.map(env => ({
			guid:         env.guid,
			isProduction: env.isProduction,
			name:         env.name
		}));
	}

	/**
	 * Formats a platform org into an org object.
	 * @param {Object} account - The account object.
	 * @param {PlatformOrg} platformOrg - The platform org object.
	 * @returns {Promise<Org>}
	 */
	async init(account: Account, platformOrg: PlatformOrg): Promise<Org> {
		const subscriptions: Subscription[] = (platformOrg.subscriptions.map((s: PlatformSubscription) => {
			return {
				category:   s.product,  // TODO: Replace with annotated name
				edition:    s.plan,     // TODO: Replace with annotated name
				endDate:    s.end_date,
				expired:    !!s.expired,
				governance: s.governance || 'SaaS',
				startDate:  s.start_date,
				tier:       s.tier
			} as Subscription;
		}) || []) as Subscription[];

		const { teams } = await this.sdk.team.list(account, platformOrg.org_id);

		const result: Org = {
			active:           platformOrg.active,
			created:          platformOrg.created,
			entitlements:     (platformOrg.entitlements || {}) as Entitlements,
			guid:             platformOrg.guid,
			insightUserCount: platformOrg.entitlements?.limit_read_only_users || 0,
			name:             platformOrg.name,
			org_id:           platformOrg.org_id,
			partners:         {},
			region:           platformOrg.region,
			seats:            platformOrg.entitlements?.limit_users === 10000 ? null : platformOrg.entitlements?.limit_users,
			subscriptions,
			teams,
			userCount:        platformOrg.users.length,
			userRoles:        platformOrg.users.find(u => u.guid === account.user.guid)?.roles || []
		};

		if (platformOrg.entitlements?.partners) {
			for (const partner of platformOrg.entitlements.partners) {
				const platformPartner: PlatformPartner | undefined = platformOrg[partner as keyof PlatformOrgPartners];
				result.partners[partner] = {
					provisioned: !!platformPartner?.provisioned
				};
			}
		}

		return result;
	}

	/**
	 * Retrieves the list of orgs from the specified account.
	 * @param {Object} account - The account object.
	 * @param {String} [defaultOrg] - The name, id, or guid of the default organization.
	 * @returns {Promise<Array>}
	 */
	async list(account: Account, defaultOrg?: string): Promise<OrgRef[]> {
		const { guid } = this.resolve(account, defaultOrg, true);

		return account.orgs
			.map(orgRef => ({
				...orgRef,
				default: orgRef.guid === guid
			}))
			.sort((a: OrgRef, b: OrgRef) => a.name.localeCompare(b.name));
	}

	/**
	 * Resolves an org by name, id, org guid using the specified account.
	 *
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} [org] - The organization object, name, guid, or id.
	 * @param {Boolean} [checkPlatformAccount=false] - When `true`, asserts the account is a platform account.
	 * @returns {Object} Resolves the org info from the account object.
	 * @access public
	 */
	resolve(account: Account, org?: OrgLike, checkPlatformAccount = false): OrgRef {
		if (checkPlatformAccount) {
			this.assertPlatformAccount(account);
		}

		if (org && typeof org === 'object' && org.guid) {
			return {
				default: !!org.default,
				guid: org.guid,
				name: org.name,
				org_id: org.org_id
			};
		}

		if (org === undefined) {
			// get the default org guid
			org = account.org.guid;
		}

		if (typeof org !== 'string' && typeof org !== 'number') {
			throw E.INVALID_ARGUMENT('Expected organization identifier');
		}

		const subject = String(org).toLowerCase();
		const found: OrgRef | undefined = account.orgs.find(o => {
			return o.guid.toLowerCase() === subject
				|| (o.name && o.name.toLowerCase() === subject) // service accounts don't have access to the org name
				|| String(o.org_id) === subject;
		});

		if (!found) {
			throw new Error(`Unable to find the organization "${org}"`);
		}

		log(`Resolved org "${org}"${found.name ? ` as ${found.name}` : ''} (${found.org_id}) ${found.guid}`);

		return found;
	}

	/**
	 * Renames an org.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} name - The new organization name.
	 * @returns {Promise<Object>}
	 */
	async rename(account: Account, org: OrgLike, name: string): Promise<{
		name: string,
		oldName: string,
		org: Org
	}> {
		const { org_id, name: oldName } = this.resolve(account, org, true);

		if (typeof name !== 'string' || !(name = name.trim())) {
			throw E.INVALID_ARGUMENT('Organization name must be a non-empty string');
		}

		const platformOrg: PlatformOrg = await this.sdk.request(`/api/v1/org/${org_id}`, account, {
			errorMsg: 'Failed to rename organization',
			json: { name },
			method: 'put'
		});

		return {
			name,
			oldName,
			org: await this.init(account, platformOrg)
		};
	}

	/**
	 * Retrieves organization usage information.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} [org] - The organization object, name, id, or guid.
	 * @param {Object} [params] - Various parameters.
	 * @param {String} [params.from] - The start date in ISO format.
	 * @param {String|Boolean} [params.month] - A month date range. Overrides `to` and
	 * `from`. If `true`, uses current month.
	 * @param {String} [params.to] - The end date in ISO format.
	 * @returns {Promise<Object>}
	 */
	async usage(account: Account, org?: OrgLike, params?: UsageParams): Promise<UsageResult> {
		const { org_id } = this.resolve(account, org, true);

		if (params === undefined) {
			params = {} as UsageParams;
		}

		if (params.month !== undefined) {
			Object.assign(params, resolveMonthRange(params.month));
		}

		const { from, to } = resolveDateRange(params.from, params.to);

		let url = `/api/v1/org/${org_id}/usage`;
		if (from) {
			url += `?from=${from.toISOString()}`;
		}
		if (to) {
			url += `${from ? '&' : '?'}to=${to.toISOString()}`;
		}

		const results: PlatformOrgUsage = await this.sdk.request(url, account, {
			errorMsg: 'Failed to get organization usage'
		});

		if (results.bundle?.metrics) {
			for (const [ metric, info ] of Object.entries(results.bundle.metrics)) {
				if (!info.name) {
					info.name = (await this.sdk.entitlement.find(account, metric)).title;
				}
			}
		}

		return {
			...results,
			from,
			to
		};
	}

	/**
	 * Adds a user to an org.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} email - The user's email.
	 * @param {Array.<String>} roles - One or more roles to assign. Must include a "default" role.
	 * @returns {Promise<Object>}
	 */
	async userAdd(account: Account, org: OrgLike, email: string, roles: string[]): Promise<{
		org: OrgRef,
		user?: OrgUser
	}> {
		const orgRef = this.resolve(account, org, true);
		const { guid } = await this.sdk.request(`/api/v1/org/${orgRef.org_id}/user`, account, {
			errorMsg: 'Failed to add user to organization',
			json: {
				email,
				roles: await this.sdk.role.resolve(account, roles, {
					org: orgRef,
					requireDefaultRole: true
				})
			}
		});
		log(`User "${guid}" added to org ${orgRef.name} (${orgRef.guid})`);
		return {
			org: orgRef,
			user: await this.userFind(account, orgRef, guid)
		};
	}

	/**
	 * Finds a user and returns their information.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} [org] - The organization object, name, id, or guid.
	 * @param {String} user - The user email or guid.
	 * @returns {Promise<Object>}
	 */
	async userFind(account: Account, org: OrgLike, user: string): Promise<OrgUser | undefined> {
		const { users } = await this.userList(account, org);
		user = user.toLowerCase();
		return users.find(u => String(u.email).toLowerCase() === user || String(u.guid).toLowerCase() === user);
	}

	/**
	 * Lists all users in an org.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} [org] - The organization object, name, id, or guid.
	 * @returns {Promise<Object>}
	 */
	async userList(account: Account, org?: OrgLike): Promise<{ org: OrgRef, users: OrgUser[] }> {
		const orgRef = this.resolve(account, org, false); // this should be true
		const users: PlatformOrgUser[] = await this.sdk.request(`/api/v1/org/${orgRef.org_id}/user?clients=1`, account, {
			errorMsg: 'Failed to get organization users'
		});

		return {
			org: orgRef,
			users: users
				.map((user: PlatformOrgUser) => {
					return {
						client_id: user.client_id,
						email:     user.email,
						firstname: user.firstname,
						guid:      user.guid,
						lastname:  user.lastname,
						name:      user.name,
						primary:   user.primary,
						roles:     user.roles
					} as OrgUser;
				})
				.sort((a, b) => {
					if ((a.client_id && !b.client_id) || (!a.client_id && b.client_id)) {
						return !a.client_id ? -1 : a.client_id ? 1 : 0;
					}
					const aname = a.name || `${a.firstname} ${a.lastname}`.trim();
					const bname = b.name || `${b.firstname} ${b.lastname}`.trim();
					return aname.localeCompare(bname);
				})
		};
	}

	/**
	 * Removes an user from an org.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} user - The user email or guid.
	 * @returns {Promise<Object>}
	 */
	async userRemove(account: Account, org: OrgLike, user: string): Promise<{
		org: OrgRef,
		user: OrgUser
	}> {
		const orgRef: OrgRef = this.resolve(account, org, true);
		const found = await this.userFind(account, orgRef, user);

		if (!found) {
			throw new Error(`Unable to find the user "${user}"`);
		}

		await this.sdk.request(`/api/v1/org/${orgRef.org_id}/user/${found.guid}`, account, {
			errorMsg: 'Failed to remove user from organization',
			method: 'delete'
		});

		return {
			org: orgRef,
			user: found
		};
	}

	/**
	 * Updates a users role in an org.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} user - The user email or guid.
	 * @param {Array.<String>} roles - One or more roles to assign. Must include a "default" role.
	 * @returns {Promise<Object>}
	 */
	async userUpdate(account: Account, org: OrgLike, user: string, roles: string[]): Promise<{
		org: OrgRef,
		roles: string[],
		user?: OrgUser
	}> {
		const orgRef: OrgRef = this.resolve(account, org, true);
		const found = await this.userFind(account, org, user);

		if (!found) {
			throw new Error(`Unable to find the user "${user}"`);
		}

		roles = await this.sdk.role.resolve(account, roles, { org: orgRef, requireDefaultRole: true });

		await this.sdk.request(`/api/v1/org/${orgRef.org_id}/user/${found.guid}`, account, {
			errorMsg: 'Failed to update user\'s organization roles',
			json: {
				roles
			},
			method: 'put'
		});

		return {
			org: orgRef,
			roles,
			user: await this.userFind(account, org, found.guid)
		};
	}
}
