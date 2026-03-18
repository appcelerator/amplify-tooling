import { initSDK, loadConfig } from '@axway/amplify-cli-utils';
import snooplogg from 'snooplogg';
import { CliConfigKeys, CliConfigManager } from './cliconfigmanager.js';
import { AuthUrls, Platforms, PlatformTeam, PreprodBaseUrls, ProdBaseUrls } from './types';

const { log } = snooplogg('central: CoreConfigController');

// TODO: https://jira.axway.com/browse/APIGOV-20520
// interface AuthenticationError extends Error {
// 	errors?: Array<object>;
// }

type DosaUserInfo = {
	axwayId: null;
	organization: null;
};

type RegularUserInfo = {
	email: string; // 'agrakhov@axway.com';
	firstName: string; // 'Alexey';
	guid: string; // '07e6b449-3a31-4a96-8920-e87dd504cb87';
	lastName: string; // 'Grakhov';
};

type RegularUserOrgInfoV4 = {
	id: number; // 576227026211882;
	// note: entitlements, name, region, guid are optional only because of the v2-v4 mapper,
	// not optional on v4 account object itself.
	entitlements?: object; // entitlements": { "partners": ["api_central"] }
	guid?: string; // '3bcf145c-9f77-48fe-9479-68b094febabc';
	name?: string; // 'Vertex';
	region?: string; // 'US'
	teams: PlatformTeam[];
};

type DosaOrgInfoV4 = {
	org_id: string; // "576227026211882",
	// note: guid is optional only because of the v2-v4 mapper
	guid?: string; // "3bcf145c-9f77-48fe-9479-68b094febabc"
	name: string;
	region?: string; // 'US'
	teams: PlatformTeam[];
};

export enum AccountRole {
	AnalyticsSpecialist = 'analytics_specialist',
	ApiCentralAdmin = 'api_central_admin',
	FileTransferServicesAdmin = 'fts_admin',
	FlowCentralAccessManager = 'fc_access_manager',
	FlowCentralIntegration = 'fc_integration',
	FlowCentralITAdmin = 'fc_it_admin',
	FlowCentralProductsAdmin = 'fc_products_admin',
	FlowCentralSpecOps = 'fc_spec_ops',
	FlowCentralSubscriptionApprover = 'fc_subscriptionapprover',
	FlowCentralSubscriptionSpecialist = 'fc_subscriptionspecialist',
	FlowCentralTemplatePublisher = 'fc_templatepublisher',
	FlowCentralCftAdmin = 'fc_cft_admin',
	PlatformAdmin = 'administrator',
	PlatformAuditor = 'auditor',
	PlatformCollaborator = 'collaborator',
	PlatformConsumer = 'consumer',
	PlatformDeveloper = 'developer',
	PlatformReadOnly = 'read_only',
	RuntimeServicesAdmin = 'ars_admin',
}

export interface AccountV4 {
	auth: {
		authenticator: string; // 'PKCE';
		baseUrl: string; // 'https://login.axwaytest.net';
		clientId: string; // 'amplify-cli';
		env: string; // 'staging';
		expires: {
			access: number; // 1602703437986;
			refresh: number; // 1602723237986;
		};
		realm: 'Broker';
		tokens: {
			access_token: string; // 'eyJhb...ReBMg';
			expires_in: number; // 1800;
			refresh_expires_in: number; // 21600;
			refresh_token: string; // 'eyJhbG...p5To';
			token_type: 'bearer';
			id_token: string; // 'eyJh...Njg';
			'not-before-policy': number; // 1552677851;
			session_state: string; // '35733295-1631-4b33-adcc-bebb50caed55';
			scope: string; // 'openid';
		};
	};
	default: boolean;
	hash: string; // 'amplify-cli:fd0b1f4328d48b7700878f62f8f23afb';
	name: string; // 'amplify-cli:agrakhov@axway.com';
	org: RegularUserOrgInfoV4 | DosaOrgInfoV4;
	orgs: (Pick<RegularUserOrgInfoV4, 'id' | 'guid' | 'name'> | DosaOrgInfoV4)[];
	role: AccountRole;
	roles: AccountRole[];
	user: RegularUserInfo | DosaUserInfo;
	// isPlatform = false for service accounts
	isPlatform: boolean;
	// sid is not available for DOSA accounts.
	sid?: string; // 's:e8eKeurfiOarqfWcOMOSItsz-EE8nMP2.yCZKRkPu7zuAZE0aDJUoNbExnqR2Uwt+wnz6KcVSeaA';
	team: PlatformTeam;
}

export interface AmplifySDK {
	auth: {
		find: Function;
		list: Function;
	};
	team: {
		list: Function;
	};
}

interface AuthInfoResult {
	orgId?: string;
	orgRegion?: string;
	teamGuid?: string | null;
	token: string;
}

export class CoreConfigController {
	static devOpsAccount: AccountV4 | null = null;

	/**
	 * Get authentication info
	 * @param {String} [account] The account name to use, otherwise fallsback to the default from
	 * the Axway CLI config.
	 * @param {String} [team] The team name or guid to use, otherwise fallsback to the default from
	 * the Axway CLI config.
	 * @returns object containing token and orgId. For service accounts orgId is undefined.
	 * @throws 401 if no authenticated account found.
	 */
	async getAuthInfo({
		account,
		team,
		forceGetAuthInfo,
	}: {
		account?: string;
		team?: string | null;
		forceGetAuthInfo?: boolean;
	} = {}): Promise<AuthInfoResult> {
		const configCtrl = new CliConfigManager();
		const config = loadConfig();

		// note: remove this validator after couple of versions
		configCtrl.validateSavedConfigKeys();

		log(`getAuthInfo, received account = ${account}, team = ${team}`);

		const baseUrl = process.env.AXWAY_CENTRAL_BASE_URL || configCtrl.get(CliConfigKeys.BASE_URL);

		// environment defined by using central cli "base-url" or axway "env" configs if set,
		// otherwise its undefined (equals to prod)
		const environment
			= !baseUrl
			|| baseUrl === ProdBaseUrls.US
			|| baseUrl === ProdBaseUrls.EU
			|| baseUrl === ProdBaseUrls.AP
			|| baseUrl === PreprodBaseUrls.US
			|| baseUrl === PreprodBaseUrls.EU
				? config.get('env')
				: 'staging';
		log(`getAuthInfo, baseUrl = ${baseUrl}, environment = ${environment}`);

		const { sdk } = initSDK({ env: environment }, config);
		let { devOpsAccount } = CoreConfigController;
		if (forceGetAuthInfo) {
			devOpsAccount = null;
		}

		if (!devOpsAccount || (account && devOpsAccount.name !== account)) {
			log('getAuthInfo, no cached devOpsAccount found, or account name does not match');

			if (account) {
				// ELSE IF: account name passed - ignoring defaultAccount and other accounts
				log('getAuthInfo, account value passed, trying to find a matching account');
				devOpsAccount = await sdk.auth.find(account);
			} else {
				// ELSE: trying to get any authenticated account
				log('getAuthInfo, account value not passed, trying to find default/any match');
				const list: AccountV4[] = await sdk.auth.list({ validate: true });
				log(`getAuthInfo, authenticated accounts found: ${list.length}`);

				if (list.length === 1) {
					log(`getAuthInfo, using a single account found with name: ${list[0].name}`);
					devOpsAccount = list[0];
				} else if (list.length > 1) {
					// try to find the default account
					devOpsAccount
						= list.find((a) => a.name === config.get('auth.defaultAccount')) || list.find((a) => a.default) || list[0];
				}
			}

			if (!devOpsAccount) {
				// TODO: piece of old logic here, move throwing out of the method?
				// temporary commenting out the new functionality and reverting back to the old one, will be fixed with:
				// https://jira.axway.com/browse/APIGOV-20520
				log('getAuthInfo, no devOpsAccount set after all, throwing 401');
				// const title: string = accountName
				// 	? `Account "${accountName}" cannot be found`
				// 	: 'No authenticated accounts found.';
				// const err: AuthenticationError = new Error(title);
				// err.errors = [{ status: 401, title }];
				// throw err;
				throw {
					errors: [
						{
							status: 401,
							title: account ? `Account "${account}" cannot be found` : 'No authenticated accounts found.',
						},
					],
				};
			}

			CoreConfigController.devOpsAccount = devOpsAccount;
		}

		const result: AuthInfoResult = {
			orgId: (devOpsAccount?.org as RegularUserOrgInfoV4)?.id?.toString(),
			orgRegion: devOpsAccount.org?.region,
			token:
				process.env.AXWAY_CENTRAL_AUTH_TOKEN || config.get('central.authToken', devOpsAccount.auth.tokens.access_token),
		};

		// now that we have resolved the account, we can validate the team
		if (team) {
			const { teams } = await sdk.team.list(devOpsAccount);
			const teamObj = teams.find((t: PlatformTeam) => {
				return t.guid.toLowerCase() === team.toLowerCase() || t.name.toLowerCase() === team.toLowerCase();
			});

			if (!teamObj) {
				throw new Error(`Unable to find team "${team}" in the "${devOpsAccount.org.name}" organization`);
			}

			result.teamGuid = teamObj.guid;
		} else if (team === null) {
			result.teamGuid = null;
		}

		log(`getAuthInfo, returning account = ${devOpsAccount.name}`);
		log(
			`getAuthInfo, returning token = ${result.token.substring(0, 5)}*****${result.token.substring(
				result.token.length - 5
			)}`
		);
		log(`getAuthInfo, returning orgId = ${result.orgId}`);
		log(`getAuthInfo, returning orgRegion = ${result.orgRegion}`);
		log(`getAuthInfo, returning teamGuid = ${result.teamGuid}`);

		return result;
	}

	static getEnv(): Platforms {
		return (CoreConfigController.devOpsAccount?.auth?.env as Platforms) || Platforms.prod;
	}

	static getAuthUrl(): AuthUrls {
		return (CoreConfigController.devOpsAccount?.auth?.baseUrl as AuthUrls) || AuthUrls.Prod;
	}
}
