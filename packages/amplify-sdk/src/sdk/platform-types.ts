export interface PlatformActivityEvent {
	context: string, // 'api_central', 'auth', 'org', 'team'
	data: {
		action_user_email?: string,
		action_user_guid: string,
		added_roles?: string[],
		app_id?: string,
		app_name?: string,
		automatic?: boolean,
		changes?: PlatformActivityChange[],
		client_guid?: string,
		client_id?: string,
		client_name?: string,
		envId?: string,
		envIds?: string[],
		from?: string, // 'web'
		governance?: string,
		id?: string,
		idp?: {
			id: string,
			name: string
		},
		internal?: boolean,
		ip?: string,
		modified_by?: string, // 'Platform'
		name?: string,
		org_guid?: string,
		org_id: number,
		org_name?: string,
		previous_role?: string,
		production?: boolean
		region?: string,
		removed_roles?: string[],
		role?: string,
		roles?: string[],
		team?: {
			apps?: string[],
			default: boolean,
			guid: string,
			name: string
		},
		team_guid?: string,
		team_name?: string,
		user_email?: string,
		user_firstname?: string,
		user_guid?: string,
		user_lastname?: string
	},
	details: PlatformActivityDetail[],
	event: string,
	id: string,
	message: string,
	ts: number
}

export interface PlatformActivityChange {
	k: string,
	v?: string,
	o?: string,
	a?: number
}

export interface PlatformActivityDetail {
	text: string,
	title: string
}

export interface PlatformClient {
	_id: string,
	client_id: string,
	created: string,
	created_by: {
		guid: string,
		type: string // 'user'
	},
	description?: string,
	guid: string,
	key_id?: string,
	migrated?: boolean,
	name: string,
	org_guid: string,
	roles: string[],
	tags?: string[],
	teams?: number,
	type: 'certificate' | 'secret',
	updated: string
}

export interface PlatformEntitlement {
	description: string,
	items?: { // when `type === 'array'`
		type: string // 'string'
	},
	title: string,
	type?: 'array' | 'boolean' | 'integer' | 'number',
	'x-abs'?: boolean,
	'x-allow-below-plan'?: boolean,
	'x-allow-governance'?: string[], // [ 'Axway Managed' ]
	'x-aggregate': boolean,
	'x-aggregate-envs'?: boolean,
	'x-entry-unit'?: string, // 'bytes'
	'x-event'?: string,
	'x-governance'?: string, // 'Customer Managed'
	'x-hide-if'?: boolean,
	'x-immutable'?: boolean | string[], // [ 'Bundle' ]
	'x-metric': string,
	'x-translate-metrics'?: string[],
	'x-unit': string, // 'Calls', 'GB', 'transactions'
	'x-unit-multiplier'?: number
}

export interface PlatformEntitlements {
	allowChildOrgs?: boolean,
	allowProduction?: boolean,
	'AOB.Transactions'?: number,
	'APIM.Transactions': number,
	'APIB.Transactions': number,
	apiRateMonth?: number,
	appDesigner?: boolean,
	appPreview?: boolean,
	collaboration?: boolean,
	containerPoints?: number,
	daysDataRetained?: number,
	eventRateMonth?: number,
	'Hub.Assets'?: number,
	'Hub.Subscriptions'?: number,
	'Hub.Transactions'?: number,
	hyperloop?: boolean,
	limit_read_only_users?: number,
	limit_users?: number,
	nativeSDK?: boolean,
	paidSupport?: boolean,
	partners?: PlatformEntitlementPartner[],
	premiumModules?: boolean,
	provider?: boolean,
	provision_envs?: string[], // 'sandbox'
	public_provider?: true,
	pushRateMonth?: number,
	storageDatabaseGB?: number,
	storageFilesGB?: number,
	'Streams.Events'?: number,
	transactions?: number
}

export type PlatformEntitlementPartner = 'acs' | 'analytics' | 'api_central' | 'cloud_elements';

export interface PlatformOrg extends PlatformOrgPartners {
	_id: string,
	account_id: null,
	active: boolean,
	analytics: {
		token: string
	},
	branding?: PlatformOrgBranding,
	children?: [],
	created: string, // ISO date
	created_by: {
		email: string,
		guid: string,
		name: string,
		type: string
	},
	entitlements?: PlatformEntitlements,
	envs?: string[],
	guid: string,
	has_apps: boolean,
	internal: boolean,
	last_login?: string, // ISO date
	last_push?: string, // ISO date
	last_push_success?: boolean,
	logged_in_count?: number,
	name: string,
	org_id: number,
	region: string,
	subscriptions: PlatformSubscription[],
	support_access_code: null,
	updated?: string, // ISO date
	users: PlatformOrgUserRef[]
}

export interface PlatformOrgBranding {
	catalog_header_left: string,
	catalog_header_right: string,
	catalog_tile_border: string,
	catalog_tile_border_hover: string,
	logo: string
}

export interface PlatformOrgEnvironment {
	_id: string, // 'production'
	acsBaseUrl?: string,
	created?: string, // ISO date
	created_by?: {
		guid: string,
		type: string // 'user'
	},
	governance?: string, // 'Customer Managed'
	guid?: string,
	isProduction: boolean,
	name: string,
	nodeACSEndpoint?: string,
	org_guid?: string,
	source?: string, // 'api_central'
	type?: string, // 'usage'
	updated?: string // ISO date
}

export interface PlatformOrgPartners {
	acs?: PlatformPartner,
	api_central?: PlatformPartner,
	cloud_elements?: PlatformPartner
}

export interface PlatformOrgRef {
	guid: string,
	name: string,
	org_id: number,
	role: string
}

export interface PlatformOrgUsage {
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
	from: string, // ISO date
	from_ts: number,
	org_id: number,
	to: string, // ISO date
	to_ts: number,
	usage: {
		[name: string]: {
			[metric: string]: PlatformOrgUsageMetric
		}
	}
}

export interface PlatformOrgUsageMetric {
	envs: {
		[name: string]: any
	},
	name: string,
	quota: number,
	percent: number,
	unit: string,
	value: number
}

export interface PlatformOrgUser {
	_id?: string,
	activated?: boolean,
	active?: boolean,
	client_id?: string,
	created: string, // ISO date
	created_by?: {
		guid: string,
		type: string // 'user'
	},
	date_activated?: string, // ISO date
	email?: string,
	external?: boolean,
	firstname?: string,
	guid: string,
	last_login?: string, // ISO date
	lastname?: string,
	name: string,
	nodeacs?: boolean,
	org_guid?: string,
	org_id?: number,
	primary: boolean,
	role: string,
	roles: string[],
	teams: number,
	type?: string, // 'secret'
	user_id: number
}

export interface PlatformOrgUserRef {
	guid: string,
	primary?: boolean,
	roles: string[]
}

export interface PlatformPartner {
	provisioned: boolean,
	provisioned_date: string, // ISO date
	provisioned_envs?: string[], // 'sandbox'
	requested_date: string, // ISO date
	requested_envs?: string[], // 'sandbox'
	state: string // 'provisioned'
}

export interface PlatformRole {
	client?: boolean,
	default?: boolean,
	entitlement?: string, // 'containerPoints'
	id: string,
	name: string,
	order?: number,
	org?: boolean,
	partner?: string, // 'api_central'
	product?: string, // 'ars'
	required_default_roles?: string[], // [ 'administrator', 'developer' ]
	subscription?: string[],
	team?: boolean
}

export interface PlatformRoleRef {
	id: string,
	name: string
}

export interface PlatformSession {
	from: string,
	guid: string,
	idp: string,
	nodeacs: boolean,
	org: PlatformOrg,
	orgs: PlatformOrgRef[],
	org_id: number,
	role: string, // 'administrator'
	roles: string[], // [ 'administrator', 'ars_admin', 'api_central_admin' ]
	sessionID: string,
	sid: string,
	teams: PlatformTeamRef[],
	token: string,
	user: PlatformUser,
	username: string
}

export interface PlatformSubscription {
	end_date: string, // ISO date
	entitlements: PlatformEntitlements,
	expired: boolean,
	governance: string, // 'SaaS'
	id: string,
	plan: string,
	product: string,
	source?: string,
	start_date: string, // ISO date
	tier: string
}

export interface PlatformTeam {
	_central_migrated?: boolean,
	_default?: boolean,
	_id: string,
	apps: string[],
	created: string, // ISO date
	default: boolean,
	desc?: string,
	guid: string,
	name: string,
	org_guid: string,
	tags: string[],
	updated: string, // ISO date
	users: PlatformTeamUser[]
}

export interface PlatformTeamRef {
	apps: string[],
	default: boolean,
	guid: string,
	name: string,
	roles: PlatformRoleRef[]
}

export interface PlatformTeamUser {
	guid: string,
	roles: string[],
	type: 'client' | 'user'
}

export interface PlatformUser {
	_id: string,
	activated?: boolean,
	active?: boolean,
	created: string, // ISO date
	date_activated: string, // ISO date
	disable_2fa?: boolean,
	email: string,
	external?: boolean,
	firstname: string,
	guid: string,
	is_titan?: number,
	last_browser_language?: string,
	last_logged_in_org?: number,
	last_login?: string, // ISO date
	lastname: string,
	logged_in_count?: number,
	logged_in_from_cli?: boolean,
	logged_in_from_other?: boolean,
	logged_in_from_studio?: boolean,
	logged_in_from_web?: boolean,
	login_org?: string, // 'last_logged'
	oidc_org?: number,
	password_updated?: string, // ISO date
	prefs?: {
		chart_scale_page: boolean,
		collapse_nav: boolean,
		favorite_apps: string[],
		hide_custom_query_doc: boolean,
		inactivity_period: number,
		map: {
			bounds: {
				_ne: {
					lat: number,
					lng: number
				},
				_sw: {
					lat: number,
					lng: number
				}
			},
			center: {
				lat: number,
				lng: number
			},
			zoom: number
		},
		notification_checked: {
			[key: string]: string
		},
		roles_documentation: boolean,
		theme: string
	},
	timezone?: string,
	updated: string, // ISO date
	user_id: number
}
