import Base from './base.js';
import E from '../errors.js';
import snooplogg from 'snooplogg';
import { Account, Entitlements, Org, OrgRef, OrgLike } from '../types.js';
import { PlatformEntitlementPartner, PlatformRole } from './platform-types.js';

const { log } = snooplogg('amplify-sdk:auth');
const { highlight } = snooplogg.styles;

export default class AmplifySDKRole extends Base {
	/**
	 * Get all roles.
	 * @param {Object} account - The account object.
	 * @param {Object} [params] - Various parameters.
	 * @param {Boolean} [params.client] - When `true`, returns client specific roles.
	 * @param {Boolean} [params.default] - When `true`, returns default roles only.
	 * @param {Object|String|Number} [params.org] - The organization object, name, id, or guid.
	 * @param {Boolean} [params.team] - When `true`, returns team specific roles.
	 * @returns {Promise<Object>}
	 */
	async list(account: Account, params?: {
		client?: boolean,
		default?: boolean,
		org?: OrgLike,
		team?: boolean
	}): Promise<PlatformRole[]> {
		if (params === undefined) {
			params = {};
		}

		let roles: PlatformRole[] = await this.sdk.request(
			`/api/v1/role${params.team ? '?team=true' : ''}`,
			account,
			{ errorMsg: 'Failed to get roles' }
		);

		const orgLike = params.org || account.org?.guid;
		if (orgLike) {
			const org: Org = await this.sdk.org.find(account, orgLike);
			const { entitlements, subscriptions } = org;

			roles = roles.filter((role: PlatformRole) => {
				return role.org
					&& (!role.partner || entitlements.partners?.includes(role.partner as PlatformEntitlementPartner) && org.partners[role.partner as PlatformEntitlementPartner]?.provisioned)
					&& (!role.entitlement || entitlements[role.entitlement as keyof Entitlements])
					&& (!role.subscription || subscriptions.find(sub => {
						return new Date(sub.endDate) >= new Date() && role.subscription?.includes(sub.category);
					}));
			});
		}

		if (params.client) {
			roles = roles.filter((r: PlatformRole) => r.client);
		}

		if (params.default) {
			roles = roles.filter((r: PlatformRole) => r.default);
		}

		if (params.team) {
			roles = roles.filter((r: PlatformRole) => r.team);
		}

		return roles;
	}

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
	async resolve(account: Account, roles: string[], opts: {
		client?: boolean,
		default?: boolean,
		org?: OrgRef,
		requireRoles?: boolean,
		requireDefaultRole?: boolean,
		team?: boolean
	}): Promise<string[]> {
		if (!Array.isArray(roles)) {
			throw E.INVALID_ARGUMENT('Expected roles to be an array');
		}

		if (opts === undefined) {
			opts = {};
		}

		if (!roles.length && !opts.requireRoles && !opts.requireDefaultRole) {
			return [];
		}

		const allowedRoles: PlatformRole[] = await this.list(account, {
			client:  opts.client,
			default: opts.default,
			org:     opts.org,
			team:    opts.team
		});
		const defaultRoles: string[] = allowedRoles.filter(r => r.default).map(r => r.id);

		if (!roles.length && opts.requireDefaultRole) {
			throw new Error(`Expected at least one of the following roles: ${defaultRoles.join(', ')}`);
		}
		if (!roles.length && opts.requireRoles) {
			throw new Error(`Expected at least one of the following roles: ${allowedRoles.join(', ')}`);
		}

		roles = roles
			.reduce((arr, role: string) => arr.concat(role.split(',')), [] as string[])
			.map((role: string) => {
				const lr = role.toLowerCase().trim();
				const found = allowedRoles.find(ar => ar.id === lr || ar.name.toLowerCase() === lr);
				if (!found) {
					throw new Error(`Invalid role "${role}", expected one of the following: ${allowedRoles.map(r => r.id).join(', ')}`);
				}
				return found.id;
			});

		log(`Resolved roles: ${highlight(roles.join(', '))}`);

		if (opts.requireDefaultRole && !roles.some((r: string) => defaultRoles.includes(r))) {
			throw new Error(`You must specify a default role: ${defaultRoles.join(', ')}`);
		}

		return roles;
	}
}
