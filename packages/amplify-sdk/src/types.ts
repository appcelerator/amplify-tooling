export interface Account {
    auth: {
        baseUrl: string,
        expires: {
            access: number,
            refresh: number
        }
    };
    hash: string;
    name: string;
    org: {
        guid: string,
        id?: number,
        name: string
    };
    orgs: [
        {
            id?: number,
            name: string
        }
    ]
}

export interface AuthenticatorHashParams {
    clientSecret?: string;
}
