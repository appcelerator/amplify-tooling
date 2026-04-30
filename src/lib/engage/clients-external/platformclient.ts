import { initSDK } from '../../amplify-sdk/index.js';
import { getAuthConfigEnvSpecifier } from '../utils/utils.js';
import { PlatformTeam } from '../types.js';
import logger from '../../logger.js';
import loadConfig from '../../config.js';
import { Account } from '../../../types.js';

const { log } = logger('central:class.PlatformClient');

export enum PlatformAuthMethod {
	Certificate = 'certificate',
	Secret = 'secret',
}

export enum PlatformServiceAccountRole {
	ApiCentralAdmin = 'api_central_admin',
	FlowCentralAccessManager = 'fc_access_manager',
	FlowCentralIntegration = 'fc_integration',
	FlowCentralITAdmin = 'fc_it_admin',
	FlowCentralProductsAdmin = 'fc_products_admin',
	FlowCentralSpecOps = 'fc_spec_ops',
	FlowCentralSubscriptionApprover = 'fc_subscriptionapprover',
	FlowCentralSubscriptionSpecialist = 'fc_subscriptionspecialist',
	FlowCentralTemplatePublisher = 'fc_templatepublisher',
	FlowCentralCftAdmin = 'fc_cft_admin',
}

export enum PlatformTeamMemberRole {
	Admin = 'administrator',
	Developer = 'developer',
	Consumer = 'consumer',
	CatalogManager = 'catalog_manager',
}

export type PlatformClientResult<T> = {
	data: null | {
		result: T;
		success: boolean;
	};
	error: null | any[];
};

/** Options used to create a service account via the PlatformClient.createServiceAccount() method. */
export interface PlatformServiceAccountCreateOptions {
	name: string;
	desc: string;
	publicKey?: null | string;
	roles?: null | PlatformServiceAccountRole[];
	secret?: null | string;
	teams?: null | [{ guid: string; role: PlatformTeamMemberRole }];
}

/** Provides information for a platform service account. */
export interface PlatformServiceAccount {
	client_id: string;
	created: string; // '2019-10-10T17:19:43.721Z'
	description: string; // 'My Service Description'
	guid: string; // '6b2b5192-6599-48a9-997d-9af61b7d5f2a'
	name: string; // 'MyService'
	org_guid: string; // '4a8a4a98-befd-4062-bb36-b4567f47eb87'
	roles: PlatformServiceAccountRole[]; // [PlatformServiceAccountRole.ApiCentralAdmin]
	type: PlatformAuthMethod; // PlatformAuthMethod.Certificate or PlatformAuthMethod.Secret
	updated: string; // '2020-04-24T17:49:14.600Z'
}

export class PlatformClient {
	#baseUrl?: string;
	#accountName?: string;
	#amplifyConfig: any;
	#amplifySdk: any;
	#initialized: boolean = false;

	constructor({ baseUrl, region, account }: { baseUrl?: string; region?: string; account?: string } = {}) {
		log(`initializing client with params: baseUrl = ${baseUrl}, region = ${region}, account = ${account}`);

		this.#baseUrl = baseUrl;
		this.#accountName = account;
	}

	private async initialize() {
		if (this.#initialized) {
			return;
		}
		const sdk = await initSDK({
			baseUrl: this.#baseUrl,
			username: this.#accountName,
		});
		this.#amplifyConfig = await loadConfig();
		this.#amplifySdk = sdk;
		this.#initialized = true;
	}

	async getAccountInfo(): Promise<Account> {
		await this.initialize();
		// Get default teams from config.
		const defaultTeams = this.#amplifyConfig.get(
			`${getAuthConfigEnvSpecifier(this.#amplifySdk.env?.name)}.defaultTeam`
		);

		// Fetch specified account or default account currently logged in.
		let accountInfo;
		if (this.#accountName) {
			accountInfo = await this.#amplifySdk.auth.find(this.#accountName, defaultTeams);
			if (!accountInfo) {
				throw new Error(`Account "${this.#accountName}" not found`);
			}
		}

		if (!accountInfo) {
			const accountArray = (await this.#amplifySdk.auth.list({
				defaultTeams,
				validate: true,
			})) as any[];
			if (accountArray) {
				accountInfo = accountArray.find((nextAccount) => nextAccount.default) || accountArray[0];
			}
		}

		// Make sure "subscriptions" is defined since Amplify SDK requires it. (Will throw error if missing.)
		if (accountInfo && accountInfo.org && !accountInfo.org.subscriptions) {
			accountInfo.org.subscriptions = [];
		}

		// Return account info if found.
		console.log(accountInfo);
		return accountInfo;
	}

	async createServiceAccount(options: PlatformServiceAccountCreateOptions): Promise<PlatformServiceAccount> {
		const accountInfo = await this.getAccountInfo();
		const result = await this.#amplifySdk.client.create(accountInfo, accountInfo?.org, options);
		return result.client;
	}

	async getServiceAccounts(filterRole?: string): Promise<PlatformServiceAccount[]> {
		const result = await this.#amplifySdk.client.list(await this.getAccountInfo());
		let clients = (result.clients || []) as PlatformServiceAccount[];
		if (filterRole) {
			log('filter clients by ', filterRole);
			clients = clients.filter((client: PlatformServiceAccount) => client?.roles.find((r) => r === filterRole));
		}
		return clients;
	}

	async getTeams(): Promise<PlatformTeam[]> {
		log('getTeams');
		const account: Account = await this.getAccountInfo();
		const { teams } = await this.#amplifySdk.team.list(account);
		const teamGuid = account.team?.guid && teams.find((team: PlatformTeam) => team.guid === account.team.guid)?.guid;
		return teams.map((team: PlatformTeam) => ({
			...team,
			default: (teamGuid && team.guid === teamGuid) || (!teamGuid && team.default),
		}));
	}
}
