export interface Subscription {
    category: string,
    edition: string,
    expired: boolean,
    governance: string,
    startDate: string,
    endDate: string,
    tier: string
}

export interface Entitlement {
    [key: string]: string
}

export interface Org {
    active?: boolean,
    created?: string,
    default?: boolean,
    entitlements: Entitlement,
    guid?: string,
    id?: number,
    name?: string,
    org_id?: number,
    region?: string,
    insightUserCount?: number,
    subscriptions: Subscription[],
    teams: Team[]
}

export interface Team {

}

export interface PlatformRole {
    client: boolean,
    default: boolean,
    id: string,
    name: string,
    org: boolean,
    partner?: string,
    entitlement?: string,
    subscription: {
        end_date: string,
        product: string
    }[],
    team: boolean
}

export interface User {
    axwayId?: string,
    email?: string,
    firstName?: string,
    guid?: string,
    lastName?: string,
    organization?: string
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
export interface Account {
    auth: AccountAuthInfo,
    hash: string,
    isPlatform?: boolean,
    isPlatformTooling?: boolean,
    name: string,
    org: Org,
    orgs: Org[],
    role: string,
    roles: string[],
    sid?: string,
    team?: Team,
    user: User
}
