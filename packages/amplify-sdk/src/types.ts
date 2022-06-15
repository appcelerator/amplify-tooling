import {
	PlatformActivityEvent,
	PlatformEntitlement,
	PlatformEntitlements,
	PlatformOrgUsageMetric,
	PlatformRole
} from './sdk/platform-types.js';
import { Got } from 'got/dist/source/types.js';
import * as request from '@axway/amplify-request';

export interface Account {
	auth: AccountAuthInfo,
	hash: string,
	isPlatform?: boolean,
	isPlatformTooling?: boolean,
	name: string,
	org: Org,
	orgs: OrgRef[],
	role?: string,
	roles?: string[],
	sid?: string,
	team?: Team,
	user: User
}

export interface AccountAuthInfo {
	authenticator: string,
	baseUrl: string,
	clientId: string,
	clientSecret?: string,
	env: string,
	expired?: boolean,
	expires: {
		access: number,
		refresh: number | null
	},
	idp?: string,
	password?: string,
	realm: string,
	secret?: string,
	tokens: {
		access_token: string,
		expires_in: number,
		id_token: string,
		refresh_expires_in: number,
		refresh_token: string
	},
	username?: string
}

export interface ActivityEvent extends PlatformActivityEvent {}

export interface ActivityParams {
	from?: string,
	month?: string,
	org?: OrgLike,
	to?: string,
	userGuid?: string
}

export interface ActivityResult {
	from: Date,
	to: Date,
	events: ActivityEvent[]
}

export interface AmplifySDKOptions {
	baseUrl?: string,
	clientId?: string,
	clientSecret?: string,
	env?: string,
	got?: Got,
	onOpenBrowser?: (p: { url: string }) => void,
	password?: string,
	platformUrl?: string,
	realm?: string,
	requestOptions?: request.RequestOptions,
	secretFile?: string,
	tokenStoreType?: string,
	username?: string
}

export interface Client {
	client_id: string,
	description?: string,
	guid: string,
	method: string,
	name: string,
	org_guid: string,
	teams: ClientTeam[],
	type: string
}

export interface ClientRef {
	client_id: string,
	guid: string,
	method: string,
	name: string,
	org_guid: string,
	team_count: number,
	type: string
}

export interface ClientTeam {
	guid: string,
	name?: string,
	roles: string[]
}

export interface DefaultTeams {
	[hash: string]: string
}

export interface Entitlement extends PlatformEntitlement {}

export interface Entitlements extends PlatformEntitlements {}

export interface Environment {
	guid?: string,
	isProduction: boolean,
	name: string
}

export interface Org extends OrgRef {
	active?: boolean,
	created?: string,
	entitlements: Entitlements,
	region: string,
	insightUserCount?: number,
	partners: {
		[key: string]: OrgPartner
	},
	seats?: number | null,
	subscriptions: Subscription[],
	teams: Team[],
	teamCount?: number,
	userCount?: number,
	userRoles?: string[]
}

export type OrgLike = Org | OrgRef | string | number;

export interface OrgPartner {
	provisioned: boolean
}

export interface OrgRef {
	default?: boolean,
	guid: string,
	name: string,
	org_id: number,
	role?: string
}

export interface OrgUser {
	client_id?: string,
	email: string,
	firstname?: string,
	guid: string,
	lastname?: string,
	name: string,
	primary: boolean,
	roles: string[]
}

export interface Role extends PlatformRole {}

export interface Subscription {
	category: string,
	edition: string,
	endDate: string, // ISO date
	expired: boolean,
	governance: string, // 'SaaS'
	startDate: string, // ISO date
	tier: string
}

export interface Team {
	default: boolean,
	desc?: string,
	guid: string,
	name: string,
	org_guid: string,
	tags: string[],
	users: TeamUser[]
}

export interface TeamInfo {
	default?: boolean,
	desc?: string,
	name?: string,
	tags?: string[]
}

export interface TeamInfoChanges {
	[key: string]: {
		v?: string | string[] | boolean,
		p?: string | string[] | boolean
	}
}

export interface TeamUser {
	client_id?: string,
	email: string,
	firstname?: string,
	guid: string,
	lastname?: string,
	name: string
	roles: string[],
	type: 'client' | 'user'
}

export interface User {
	client_id?: string,
	dateJoined?: string, // ISO date
	email: string,
	firstname: string,
	guid: string,
	lastname: string
}

export interface UserChanges {
	[key: string]: {
		v?: string | string[] | boolean,
		p?: string | string[] | boolean
	}
}

export interface UserInfo {
	firstname?: string,
	lastname?: string
}

export interface UsageParamsRange {
	from: string,
	to: string
}

export interface UsageParamsMonth {
	month: string | boolean
}

export type UsageParams = UsageParamsRange & UsageParamsMonth;

// note: this interface is identical to PlatformOrgUsage except `from` and `to`
// are Date objects instead of ISO strings
export interface UsageResult {
	basis: string, // 'range'
	bundle?: {
		edition: string,
		end_date: string, // ISO date
		metrics?: {
			[metric: string]: {
				envs: {
					[guid: string]: {
						production: boolean,
						quota: number,
						tokens: number,
						value: number
					}
				},
				name: string,
				tokens: number,
				unit: string,
				value: number
			}
		},
		name: string,
		plan: string, // 'trial'
		product: string, // 'Bundle'
		ratios: {
			[key: string]: number | boolean
		},
		start_date: string // ISO date
	},
	created: string, // ISO date
	ending: string, // ISO date
	from: Date
	from_ts: number,
	org_id: number,
	to: Date
	to_ts: number,
	usage: {
		[name: string]: {
			[metric: string]: PlatformOrgUsageMetric
		}
	}
}
