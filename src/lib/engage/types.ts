export const ABORT_TIMEOUT
	= process.env.NODE_ENV === 'test'
		? 1e3
		: process.env.DEBUG || process.env.SNOOPLOGG
			? 1e9
			: 30e3;

export const MAX_TABLE_STRING_LENGTH = 50;
export const MAX_FILE_SIZE
	= process.env.NODE_ENV === 'test' ? 1e5 : 20 * 1024 * 1024;
export const MAX_CACHE_FILE_SIZE = 5 * 1024 * 1024;

// 12 hours
export const CACHE_FILE_TTL_MILLISECONDS
	= process.env.NODE_ENV === 'test' ? 100 : 60000 * 60 * 12;
export const WAIT_TIMEOUT = process.env.NODE_ENV === 'test' ? 1e3 : 1e4;

/**
 * Invoked multiple times to indicate progress on something, such as download progress.
 * @param progress Value ranging from 0 to 100.
 */
export type ProgressListener = (progress: number) => void;

/**
 * ApiServer backend types
 */
export enum ApiServerVersions {
	v1alpha1 = 'v1alpha1',
}

export enum OutputTypes {
	yaml = 'yaml',
	json = 'json',
}

export enum LanguageTypes {
	French = 'fr-fr',
	US = 'en-us',
	German = 'de-de',
	Portugese = 'pt-br',
}

export type ApiServerError = {
	status: number;
	title: string;
	detail: string;
	source?: object;
	meta: {
		regexp?: string;
		instanceId: string;
		tenantId: string;
		authenticatedUserId: string;
		transactionId: string;
	};
};

export type ApiServerErrorResponse = {
	errors: ApiServerError[];
};

export interface ResourceDefinition {
	apiVersion: ApiServerVersions;
	kind: 'ResourceDefinition';
	name: string; // "environment"
	group: string; // "management"
	metadata: {
		id: string; // 'e4e08f487156b7c8017156b9eef60002';
		audit: {
			createTimestamp: string; // '2020-04-07T22:19:18.141+0000';
			modifyTimestamp: string; // '2020-04-07T22:19:18.141+0000'
		};
		scope: {
			id: string; // 'e4e08f487156b7c8017156b9ed930000';
			kind: string; // 'ResourceGroup';
			name: string; // 'management'
		};
		resourceVersion: string; // '1609';
		references: any[]; // [];
	};
	spec: {
		kind: string; // "Environment",
		plural: string; // "environments",
		scope?: {
			kind: string; // 'Environment'
		};
		apiVersions?: {
			name: string;
			served: boolean;
			deprecated: boolean;
		}[];
		// note: making it optional for backward-compatible logic.
		subResources?: {
			names: string[];
		};
		references: {
			toResources: {
				kind: string;
				group: string;
				types: ('soft' | 'hard')[];
				scopeKind?: string;
				from?: {
					subResourceName: string;
				};
			}[];
			fromResources: {
				kind: string;
				types: ('soft' | 'hard')[];
				scopeKind?: string;
				from?: {
					subResourceName: string;
				};
			}[];
		};
	};
}

export interface CommandLineInterfaceColumns {
	name: string; // 'Name';
	type: string; // 'string';
	jsonPath: string; // '.name';
	description: string; // 'The name of the environment.';
	hidden: boolean; // false
}

export interface CommandLineInterface {
	apiVersion: ApiServerVersions;
	kind: 'CommandLineInterface';
	name: string; // "environment"
	spec: {
		names: {
			plural: string; // 'environments';
			// 10/2022 note: "singular" value is not always equal to the "name" value anymore
			singular: string; // 'environment';
			shortNames: string[]; // ['env', 'envs'];
			shortNamesAlias?: string[]; // ['env']
		};
		columns: CommandLineInterfaceColumns[];
		resourceDefinition: string; // 'environment';
	};
	metadata: {
		scope: {
			name: string; // 'management'
		};
	};
}

export interface AuditMetadata {
	createTimestamp: string; // '2020-08-04T21:05:32.106Z';
	createUserId: string; // '07e6b449-3a31-4a96-8920-e87dd504cb87';
	modifyTimestamp: string; // '2020-08-04T21:05:32.106Z';
	modifyUserId: string; // '07e6b449-3a31-4a96-8920-e87dd504cb87';
}

interface Scope {
	id: string;
	kind: Kind;
	name: string;
}

export enum Kind {
	Environment = 'Environment',
	APIService = 'APIService',
	APIServiceRevision = 'APIServiceRevision',
	APIServiceInstance = 'APIServiceInstance',
	Asset = 'Asset',
	AssetMapping = 'AssetMapping',
	Product = 'Product',
	ReleaseTag = 'ReleaseTag',
	Secret = 'Secret',
	Webhook = 'Webhook',
	ConsumerSubscriptionDefinition = 'ConsumerSubscriptionDefinition',
	ConsumerInstance = 'ConsumerInstance',
}

export interface Metadata {
	audit: AuditMetadata;
	resourceVersion?: string;
	id: string;
	scope?: Scope;
	references: {
		id: string; // e4e0900570caf70701713be3e36a076e
		kind: string; // "Secret"
		name: string; // secret1
		types: ['soft', 'hard'];
	}[];
}

export interface GenericResource {
	apiVersion: string;
	group: string;
	title: string;
	name: string;
	kind: string;
	attributes: object;
	tags: string[];
	// note: metadata is not an optional when received from the api-server but
	// might be missing in some of our castings and in the resources from a file
	metadata?: Metadata;
	spec: any;
	// note: have to include "any" indexed type for allowing sub-resources
	[subresource: string]: any;
}

export type GenericResourceWithoutName = Omit<GenericResource, 'name'> & {
	name?: string;
};

/**
 * Client's types
 */
export type ApiServerClientListResult = {
	data: null | GenericResource[];
	error: null | ApiServerError[];
};

export type ApiServerSubResourceOperation = {
	name: string;
	operation: () => Promise<any>;
};

export type ApiServerClientSingleResult = {
	data: null | GenericResource;
	updatedSubResourceNames?: string[];
	warning?: boolean;
	error: null | ApiServerError[];
	pending?: null | Array<ApiServerSubResourceOperation>;
};

export type ApiServerClientApplyResult = {
	data?: null | GenericResource;
	wasAutoNamed?: boolean;
	wasCreated?: boolean;
	wasMainResourceChanged?: boolean;
	updatedSubResourceNames?: string[];
	error?: {
		name: string;
		kind: string;
		error: ApiServerError | Error | { detail: string; title?: string };
	}[];
};

export type ApiServerClientBulkResult = {
	success: GenericResource[];
	error: ApiServerClientError[];
	warning?: GenericResource[];
};

export type ApiServerClientError = {
	name: string;
	kind: string;
	error: ApiServerError | Error | { detail: string; title?: string };
};

export type GetSpecsResult = {
	[groupName: string]: {
		resources: Map<string, ResourceDefinition>;
		cli: Map<string, CommandLineInterface>;
	};
};

export const commonCmdArgsDescription = {
	'--account [value]': 'Override your default account config',
	'--region [value]': 'Override your region config',
	'--no-cache': 'Do not use cache when communicating with the server',
	'--base-url [value]': { hidden: true },
	'--apic-deployment [value]': { hidden: true },
	'--axway-managed': { hidden: true },
};

export interface ParsedScopeParam {
	name: string;
	kind?: string;
}

export enum AuthUrls {
	Staging = 'https://login.axwaytest.net',
	Prod = 'https://login.axway.com',
	Preprod = 'https://login.na-us.axwaypreprod.net',
}

export enum Regions {
	US = 'US',
	EU = 'EU',
	AP = 'AP',
}

export enum PreprodRegions {
	US = 'US',
	EU = 'EU',
}

export enum Platforms {
	prod = 'prod',
	staging = 'staging',
	preprod = 'preprod',
}

export const ProdBaseUrls: { [k in Regions]: string } = {
	US: 'https://apicentral.axway.com',
	EU: 'https://central.eu-fr.axway.com',
	AP: 'https://central.ap-sg.axway.com',
};

export const PreprodBaseUrls: { [k in PreprodRegions]: string } = {
	US: 'https://engage.na-us.axwaypreprod.net',
	EU: 'https://engage.eu-fr.axwaypreprod.net',
};

export const APICDeployments = {
	EU: 'prod-eu',
	EUStaging: 'staging-eu',
	QA: 'qa',
	US: 'prod',
	USStaging: 'staging',
	TEAMS: 'teams',
	AP: 'prod-ap',
	APStaging: 'preprod',
	USPreprod: 'preprod',
	EUPreprod: 'preprod',
	APPreprod: 'preprod',
};

/** Provides information for a platform team. */
export interface PlatformTeam {
	apps: any[];
	created: string; // "2019-10-10T17:19:43.721Z"
	default: boolean; // false
	desc: null | string; // null
	guid: string; // '6b2b5192-6599-48a9-997d-9af61b7d5f2a';
	name: string; // 'Avengers';
	org_guid: string; // '4a8a4a98-befd-4062-bb36-b4567f47eb87';
	tags: string[]; // [];
	updated: string; // '2020-04-24T17:49:14.600Z';
}

export enum BasePaths {
	ApiServer = '/apis',
	ApiCentral = '/api/v1',
	Platform = '/platform/api/v1',
	V7Agents = '/artifactory/ampc-public-generic-release/v7-agents',
	AWSAgents = '/artifactory/ampc-public-generic-release/aws-agents',
	DockerAgentPublicRepo = '/agent',
	DockerAgentAPIRepoPath = '/artifactory/api/docker/ampc-public-docker-release/v2/agent',
}

export interface ValidatedDocs {
	docs: Record<string, any>[];
	isMissingName: boolean;
}

export enum TrueFalse {
	True = 'True',
	False = 'False',
}

export const TrueFalseChoices = [
	{ name: TrueFalse.True, value: TrueFalse.True },
	{ name: TrueFalse.False, value: TrueFalse.False },
];

export enum YesNo {
	Yes = 'Yes',
	No = 'No',
}

export const YesNoChoices = [
	{ name: YesNo.Yes, value: YesNo.Yes },
	{ name: YesNo.No, value: YesNo.No },
];

export interface EngageCommandParams {
	account: Account;
	region?: string;
	useCache?: boolean;
	team?: string | null;
}

export interface GetCommandParams extends EngageCommandParams {
	resourceTypes: string[];
	resourceName?: string;
	scopeParam?: string;
	query?: string;
	titleFilter?: string;
	attributeFilter?: string;
	tagFilter?: string;
	/** Resolved team GUID (looked up from the teams list in the command layer). */
	teamGuid?: string;
	languageExpand?: string;
	languageDefinition?: string;
	outputFormat?: string;
	onProgress?: (percent: number) => void;
}

export interface GetResultItem {
	columns: CommandLineInterfaceColumns[];
	response: ApiServerClientSingleResult | ApiServerClientListResult;
}

export interface GetCommandResult {
	items: GetResultItem[];
	hasErrors: boolean;
	defsHelpTable?: string;
	missingResourceArg?: boolean;
	languageDefinition?: string;
}

export interface ApplyCommandParams extends EngageCommandParams {
	filePath: string;
	language?: string;
	subresource?: string;
	/** Called when file contains resources with missing names. Return false to abort. */
	onMissingNames?: () => Promise<boolean>;
}

export interface ApplyCommandResult {
	results: ApiServerClientApplyResult[];
	hasErrors: boolean;
}

export interface DeleteCommandParams extends EngageCommandParams {
	resourceType?: string;
	resourceName?: string;
	filePath?: string;
	scopeParam?: string;
	wait?: boolean;
	forceDelete?: boolean;
	skipConfirmation?: boolean;
	/** Called to confirm a single delete (scope or multi-scope). Return false to abort. */
	onConfirmSingleDelete?: (scopeProvided: boolean, matchingDefsLength: number) => Promise<boolean>;
	/** Called to confirm a force delete. Return false to abort. */
	onConfirmForceDelete?: () => Promise<boolean>;
}

export interface DeleteCommandResult {
	hasErrors: boolean;
	singleResults?: ApiServerClientSingleResult[];
	bulkResults?: ApiServerClientBulkResult;
	/** True when neither resource type nor file was provided. */
	missingArgs?: boolean;
	defsHelpTable?: string;
}

