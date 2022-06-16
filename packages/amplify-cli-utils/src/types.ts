import AmplifySDK, { Account, Org, TokenStore } from '@axway/amplify-sdk';
import { RequestOptions } from '@axway/amplify-request';

export interface BuildAuthParamsOptions extends RequestOptions {
	baseUrl?:                 string,
	clientId?:                string,
	clientSecret?:            string,
	env?:                     string,
	interactiveLoginTimeout?: number,
	homeDir?:                 string,
	password?:                string,
	persistSecrets?:          boolean,
	platformUrl?:             string,
	realm?:                   string
	requestOptions?:          RequestOptions,
	secretFile?:              string
	serverHost?:              string
	serverPort?:              number,
	serviceAccount?:          boolean,
	tokenRefreshThreshold?:   number,
	tokenStore?:              TokenStore,
	tokenStoreDir?:           string,
	tokenStoreType?:          string,
	username?:                string
}

export interface Environment {
	auth: {
		clientId: string,
		realm: string
	},
	name: string,
	title: string
}

export interface InitPlatformAccountResult {
	account: Account,
	config: Config,
	org: Org,
	sdk: AmplifySDK
}
