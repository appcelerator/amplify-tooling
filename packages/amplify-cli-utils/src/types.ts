export interface BuildAuthParamsOptions {
    env?: string
}

export interface Environment {
    auth: {
        clientId: string,
        realm: string
    },
    name: string,
    title: string
}

export interface InitSDKOptions {
    //
}
