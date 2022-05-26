export interface Subscription {
    category: string,
    edition: string,
    expired: boolean,
    governance: string,
    startDate: string,
    endDate: string,
    tier: string
}

export interface Org {
    default?: boolean,
    guid?: string,
    id?: number,
    name?: string,
    subscriptions?: Subscription[]
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
    sid?: string,
    user: {
        axwayId?: string,
        email?: string,
        firstName?: string,
        guid?: string,
        lastName?: string,
        organization?: string
    }
}
