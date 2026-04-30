import { Account } from '../../types.js';
import { ApiServerClient } from './clients-external/apiserverclient.js';
import { DefinitionsManager } from './results/DefinitionsManager.js';
import Renderer from './results/renderer.js';
import { KeyValueMapToNameValueArray } from './utils/utils.js';

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
	axwayManaged?: boolean;
	baseUrl?: string;
	apicDeployment?: string;
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

export interface CreateCommandParams extends EngageCommandParams {
	filePath: string;
	/** Called when file contains resources with missing names. Return false to abort. */
	onMissingNames?: () => Promise<boolean>;
}

export interface CreateCommandResult {
	results: ApiServerClientBulkResult;
	hasErrors: boolean;
}

export interface CreateEnvironmentCommandParams extends EngageCommandParams {
	name: string;
}

export interface AgentResourceCreateResult {
	agentType: string;
	dataPlaneName: string;
	environmentName: string;
	teamName: string;
	discoveryAgentName: string;
	ampcDiscoveryAgentName: string;
	traceabilityAgentName: string;
	ampcTraceabilityAgentName: string;
}

export interface ProductizeCommandParams extends EngageCommandParams {
	filePath: string;
	transferOwnership: boolean;
}

export interface ProductizeCommandResult {
	results: Map<string, ApiServerClientBulkResult>;
}

export interface EditEnvironmentCommandParams extends EngageCommandParams {
	name: string;
	render: Renderer;
	outputFormat?: string;
}

export type InstallAgentsCommandParams = EngageCommandParams;

export enum BundleType {
	ALL_AGENTS = 'All Agents',
	DISCOVERY = 'Discovery',
	TRACEABILITY = 'Traceability',
	TRACEABILITY_OFFLINE = 'Traceability offline mode',
}

export class EnvironmentConfigInfo {
	name: string;
	isNew: boolean;
	isUpdated: boolean;
	referencedEnvironments: string[];
	referencedIdentityProviders: [];

	constructor() {
		this.name = '';
		this.isNew = false;
		this.isUpdated = false;
		this.referencedEnvironments = [];
		this.referencedIdentityProviders = [];
	}
}

export enum AgentTypes {
	da = 'da',
	ta = 'ta',
	ca = 'ca',
}

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

export enum DataPlaneNames {
	AKAMAI = 'Akamai',
	APIGEEX = 'Apigee X',
	AWS = 'AWS',
	GITHUB = 'GitHub',
	GITLAB = 'GitLab',
	AZURE = 'Azure',
	EDGE = 'APIM',
	KAFKA = 'Kafka',
	GRAYLOG = 'Graylog',
	IBMAPICONNECT = 'APIConnect',
	KONG = 'Kong',
	SOFTWAREAGWEBMETHODS = 'WebMethods',
	SWAGGERHUB = 'SwaggerHub',
	TRACEABLE = 'Traceable',
	MULESOFT = 'Mulesoft',
	BACKSTAGE = 'Backstage',
	SAPAPIPORTAL = 'SAP API Portal',
	SENSEDIA = 'Sensedia',
	WSO2 = 'WSO2',
	OTHER = 'Unidentified',
}

export enum AgentResourceKind {
	da = 'DiscoveryAgent',
	ta = 'TraceabilityAgent',
	ca = 'ComplianceAgent',
}

class ReqHeadersQParams {
	requestHeaders?: Map<string, string>;
	queryParameters?: Map<string, string>;
}

export class IDPConfiguration extends ReqHeadersQParams {
	title: string;
	type: IDPType;
	metadataURL: string;
	clientProperties?: Map<string, string>;
	clientTimeout: number;

	constructor() {
		super();
		this.title = '';
		this.type = IDPType.Generic;
		this.metadataURL = '';
		this.clientTimeout = 60;
	}

	getSpec(): object {
		const spec = new Map<string, any>([
			[ 'metadataUrl', this.metadataURL ],
			[ 'providerType', this.type ],
			[ 'clientTimeout', this.clientTimeout ],
			[ 'requestHeaders', this.requestHeaders ? KeyValueMapToNameValueArray(this.requestHeaders) : undefined ],
			[ 'queryParameters', this.queryParameters ? KeyValueMapToNameValueArray(this.queryParameters) : undefined ],
			[
				'additionalClientProperties',
				this.clientProperties ? KeyValueMapToNameValueArray(this.clientProperties) : undefined,
			],
		]);
		const omitUndefinedSpec = new Map<string, any>();
		spec.forEach((v, k) => {
			if (v !== undefined) {
				omitUndefinedSpec.set(k, v);
			}
		});

		return Object.fromEntries(omitUndefinedSpec.entries());
	}
}

export class IDPAuthConfiguration extends ReqHeadersQParams {
	authType: IDPAuthType;
	authConfig: IDPAuthAccessToken | IDPAuthClientSecret;
	constructor() {
		super();
		this.authType = IDPAuthType.AccessToken;
		this.authConfig = new IDPAuthAccessToken();
	}

	getAccessData() {
		return this.authConfig.getAccessData();
	}

	setAccessData(data: string) {
		this.authConfig.setAccessData(data);
	}

	getSpec() {
		const spec = new Map<string, any>([
			[ 'type', this.authType ],
			[ 'config', this.authConfig.getSpec(this.authType) ],
			[ 'requestHeaders', this.requestHeaders ? KeyValueMapToNameValueArray(this.requestHeaders) : undefined ],
			[ 'queryParameters', this.queryParameters ? KeyValueMapToNameValueArray(this.queryParameters) : undefined ],
		]);
		const omitUndefinedSpec = new Map<string, any>();
		spec.forEach((v, k) => {
			if (v !== undefined) {
				omitUndefinedSpec.set(k, v);
			}
		});

		return Object.fromEntries(omitUndefinedSpec.entries());
	}
}

// IDPType - which idp configuration can be used
export enum IDPType {
	KeyCloak = 'keycloak',
	Okta = 'okta',
	Generic = 'generic',
}

export class IDPAuthAccessToken {
	token: string;

	constructor() {
		this.token = '';
	}

	getAccessData() {
		return JSON.stringify({
			token: this.token,
		});
	}

	setAccessData(data: string) {
		this.token = data;
	}

	getSpec(authType: IDPAuthType): object {
		return {
			type: authType,
			token: this.token,
		};
	}
}

export class IDPAuthClientSecret {
	authMethod: IDPClientSecretAuthMethod;
	clientID: string;
	clientSecret: string;
	clientScopes?: string[];

	constructor() {
		this.authMethod = IDPClientSecretAuthMethod.ClientSecretBasic;
		this.clientID = '';
		this.clientSecret = '';
	}

	getAccessData() {
		return JSON.stringify({
			clientSecret: this.clientSecret,
		});
	}

	setAccessData(data: string) {
		this.clientSecret = data;
	}

	getSpec(authType: IDPAuthType) {
		const spec = new Map<string, any>([
			[ 'type', authType ],
			[ 'authMethod', this.authMethod ],
			[ 'clientId', this.clientID ],
			[ 'clientSecret', this.clientSecret ],
			[ 'clientScopes', this.clientScopes ? this.clientScopes : undefined ],
		]);
		const omitUndefinedSpec = new Map<string, any>();
		spec.forEach((v, k) => {
			if (v !== undefined) {
				omitUndefinedSpec.set(k, v);
			}
		});

		return Object.fromEntries(omitUndefinedSpec.entries());
	}
}

export enum IDPClientSecretAuthMethod {
	ClientSecretBasic = 'client_secret_basic',
	ClientSecretPost = 'client_secret_post',
	ClientSecretJWT = 'client_secret_jwt',
}

export enum IDPAuthType {
	AccessToken = 'AccessToken',
	ClientSecret = 'ClientSecret',
}

export enum AgentConfigTypes {
	HOSTED = 'Hosted',
	BINARIES = 'Binaries',
	DOCKERIZED = 'Dockerized',
	HELM = 'Helm',
}

export enum GatewayMode {
	GatewayManagerMode = 'With API Manager',
	GatewayOnlyMode = 'Gateway only',
}

export enum AgentNames {
	AKAMAI_CA = 'akamai-compliance-agent',
	AWS_DA = 'aws-apigw-discovery-agent',
	AWS_TA = 'aws-apigw-traceability-agent',
	GITHUB_DA = 'github-discovery-agent',
	GITLAB_DA = 'gitlab-discovery-agent',
	APIGEEX_DA = 'apigeex-discovery-agent',
	APIGEEX_TA = 'apigeex-traceability-agent',
	AZURE_DA = 'azure-discovery-agent',
	AZURE_TA = 'azure-traceability-agent',
	AZURE_EVENTHUB_DA = 'azure-eventhub-discovery-agent',
	EDGE_DA = 'v7-discovery-agent',
	EDGE_TA = 'v7-traceability-agent',
	KAFKA_DA = 'kafka-discovery-agent',
	KAFKA_TA = 'kafka-traceability-agent',
	SWAGGERHUB_DA = 'swaggerhub-discovery-agent',
	GRAYLOG_CA = 'graylog-compliance-agent',
	IBMAPICONNECT_DA = 'ibm-apiconnect-discovery-agent',
	IBMAPICONNECT_TA = 'ibm-apiconnect-traceability-agent',
	TRACEABLE_CA = 'traceable-compliance-agent',
	SOFTWAREAGWEBMETHODS_DA = 'software-ag-webmethods-discovery-agent',
	SOFTWAREAGWEBMETHODS_TA = 'software-ag-webmethods-traceability-agent',
	BACKSTAGE_DA = 'backstage-discovery-agent',
	SAPAPIPORTAL_DA = 'sap-discovery-agent',
	SAPAPIPORTAL_TA = 'sap-traceability-agent',
	SENSEDIA_DA = 'sensedia-discovery-agent',
	SENSEDIA_TA = 'sensedia-traceability-agent',
	WSO2_DA = 'wso2-discovery-agent',
	WSO2_TA = 'wso2-traceability-agent',
}

export enum GatewayTypes {
	AKAMAI = 'Akamai',
	EDGE_GATEWAY = 'Amplify API Gateway',
	APIGEEX_GATEWAY = 'Apigee X Gateway',
	AWS_GATEWAY = 'Amazon API Gateway',
	AZURE_GATEWAY = 'Azure API Gateway',
	AZURE_EVENTHUB = 'Azure EventHub',
	GITLAB = 'GitLab',
	ISTIO = 'Istio',
	EDGE_GATEWAY_ONLY = 'Amplify API Gateway only',
	KAFKA = 'Kafka',
	GRAYLOG = 'Graylog',
	IBMAPICONNECT = 'IBM API Connect',
	SOFTWAREAGWEBMETHODS = 'Software AG WebMethods',
	TRACEABLE = 'Traceable',
	BACKSTAGE = 'Backstage',
	SAPAPIPORTAL = 'SAP API Portal',
	SENSEDIA = 'Sensedia',
	WSO2 = 'WSO2',
}

export enum SaaSGatewayTypes {
	AKAMAI = 'Akamai',
	AWS_GATEWAY = 'Amazon API Gateway',
	APIGEEX_GATEWAY = 'Apigee X Gateway',
	GITHUB = 'GitHub',
	SWAGGERHUB = 'SwaggerHub',
	TRACEABLE = 'Traceable',
}

export const GatewayTypeToDataPlane = {
	[GatewayTypes.AKAMAI]: DataPlaneNames.AKAMAI,
	[GatewayTypes.EDGE_GATEWAY]: DataPlaneNames.EDGE,
	[GatewayTypes.EDGE_GATEWAY_ONLY]: DataPlaneNames.EDGE,
	[GatewayTypes.APIGEEX_GATEWAY]: DataPlaneNames.APIGEEX,
	[GatewayTypes.AWS_GATEWAY]: DataPlaneNames.AWS,
	[SaaSGatewayTypes.GITHUB]: DataPlaneNames.GITHUB,
	[GatewayTypes.GITLAB]: DataPlaneNames.GITLAB,
	[GatewayTypes.AZURE_GATEWAY]: DataPlaneNames.AZURE,
	[GatewayTypes.AZURE_EVENTHUB]: DataPlaneNames.AZURE,
	[GatewayTypes.ISTIO]: 'Istio',
	[GatewayTypes.KAFKA]: DataPlaneNames.KAFKA,
	[GatewayTypes.SOFTWAREAGWEBMETHODS]: DataPlaneNames.SOFTWAREAGWEBMETHODS,
	[SaaSGatewayTypes.SWAGGERHUB]: DataPlaneNames.SWAGGERHUB,
	[GatewayTypes.GRAYLOG]: DataPlaneNames.GRAYLOG,
	[GatewayTypes.IBMAPICONNECT]: DataPlaneNames.IBMAPICONNECT,
	[GatewayTypes.TRACEABLE]: DataPlaneNames.TRACEABLE,
	[GatewayTypes.BACKSTAGE]: DataPlaneNames.BACKSTAGE,
	[GatewayTypes.SAPAPIPORTAL]: DataPlaneNames.SAPAPIPORTAL,
	[GatewayTypes.SENSEDIA]: DataPlaneNames.SENSEDIA,
	[GatewayTypes.WSO2]: DataPlaneNames.WSO2,
};

export const PublicRepoUrl = 'https://axway.jfrog.io';
export const PublicDockerRepoBaseUrl = 'axway.jfrog.io/ampc-public-docker-release';

export class DOSAConfigInfo {
	clientId: string | null;
	name: string;
	isNew: boolean;

	constructor() {
		this.clientId = null;
		this.name = '';
		this.isNew = false;
	}
}

export class CentralAgentConfig {
	orgId: string;
	ampcEnvInfo: EnvironmentConfigInfo;
	ampcDosaInfo: DOSAConfigInfo;
	ampcTeamName: string;
	daAgentName: string;
	taAgentName: string;
	caAgentName: string;
	dosaAccount: DosaAccount;
	environment: string;
	environmentId: string;
	region: string;
	deployment: string;
	production: boolean;
	axwayManaged: boolean;
	apiServerClient: ApiServerClient | undefined;
	definitionManager: DefinitionsManager | undefined;
	gatewayConfig: object | undefined;

	constructor() {
		this.orgId = '';
		this.ampcTeamName = '';
		this.region = Regions.US;
		this.daAgentName = '';
		this.taAgentName = '';
		this.caAgentName = '';
		this.ampcEnvInfo = new EnvironmentConfigInfo();
		this.ampcDosaInfo = new DOSAConfigInfo();
		this.dosaAccount = new DosaAccount();
		this.environment = '';
		this.environmentId = '';
		this.deployment = '';
		this.production = false;
		this.axwayManaged = false;
	}
}

export class AgentInstallSwitches {
	isDaEnabled: boolean;
	isTaEnabled: boolean;
	isHostedInstall: boolean;
	isHelmInstall: boolean;
	isGatewayOnly: boolean;
	isDockerInstall: boolean;
	isBinaryInstall: boolean;
	isOrgRep: boolean;

	constructor() {
		this.isDaEnabled = false;
		this.isTaEnabled = false;
		this.isHostedInstall = false;
		this.isHelmInstall = false;
		this.isGatewayOnly = false;
		this.isDockerInstall = false;
		this.isBinaryInstall = false;
		this.isOrgRep = false;
	}
}

export class AgentInstallConfig {
	centralConfig: CentralAgentConfig;
	bundleType: BundleType;
	gatewayType: GatewayTypes | SaaSGatewayTypes;
	deploymentType: AgentConfigTypes;
	daVersion: string;
	taVersion: string;
	caVersion: string;
	gatewayConfig: object;
	idpConfig: [IDPConfiguration[], IDPAuthConfiguration[]];
	traceabilityConfig: TraceabilityConfig;
	switches: AgentInstallSwitches;

	constructor() {
		this.centralConfig = new CentralAgentConfig();
		this.bundleType = BundleType.ALL_AGENTS;
		this.gatewayType = GatewayTypes.EDGE_GATEWAY;
		this.deploymentType = AgentConfigTypes.DOCKERIZED;
		// eslint-disable-next-line no-new-object
		this.gatewayConfig = new Object();
		this.idpConfig = [[], []];
		this.daVersion = 'latest';
		this.taVersion = 'latest';
		this.caVersion = 'latest';
		this.switches = new AgentInstallSwitches();
		this.traceabilityConfig = new TraceabilityConfig();
	}
}

export class DosaAccount {
	clientId: string;
	privateKey: string;
	publicKey: string;
	templatePrivateKey?: string;
	templatePublicKey?: string;

	constructor(clientId?: string, publicKey?: string, privateKey?: string) {
		this.clientId = clientId || '';
		this.privateKey = privateKey || 'private_key.pem';
		this.publicKey = publicKey || 'public_key.pem';
	}

	updateKeyTemplateValues = (configType: AgentConfigTypes) => {
		switch (configType) {
			case AgentConfigTypes.BINARIES: {
				this.templatePrivateKey = 'private_key.pem';
				this.templatePublicKey = 'public_key.pem';
				break;
			}
			case AgentConfigTypes.DOCKERIZED: {
				this.templatePrivateKey = '/keys/private_key.pem';
				this.templatePublicKey = '/keys/public_key.pem';
				break;
			}
			default: {
				this.templatePrivateKey = this.privateKey;
				this.templatePublicKey = this.publicKey;
				break;
			}
		}
	};
}

export class TraceabilityConfig {
	usageReportingOffline: boolean;

	constructor() {
		this.usageReportingOffline = false;
	}
}

export class ApigeeMetricsFilterConfig {
	filterMetrics: boolean;
	filteredAPIs: string[];

	constructor(filterMetrics: boolean, filteredAPIs: string[]) {
		this.filterMetrics = filterMetrics;
		this.filteredAPIs = filteredAPIs;
	}
}

// AWSRegions - base set of regions, may use option outside this list
export enum AWSRegions {
	US_EAST_1 = 'us-east-1',
	US_EAST_2 = 'us-east-2',
	US_WEST_1 = 'us-west-1',
	US_WEST_2 = 'us-west-2',
	EU_WEST_1 = 'eu-west-1',
	EU_WEST_2 = 'eu-west-2',
	EU_WEST_3 = 'eu-west-3',
}

export enum APIGEEXDISCOVERYMODES {
	PROXY = 'proxy',
	PRODUCT = 'product',
}

export enum AzureDataplaneMode {
	APIM = 'APIM',
	EventHub = 'EventHub',
}

export enum Protocol {
	HTTP = 'http',
	HTTPS = 'https',
}

export enum Certificate {
	PROVIDE = 'PROVIDE',
	GENERATE = 'GENERATE',
}

export class CloudFormationConfig {
	AgentResourcesBucket: string;
	APIGWCWRoleSetup: string;
	APIGWTrafficLogGroupName: string;
	DeploymentType: string;
	EC2VPCID: string;
	EC2KeyName: string;
	EC2InstanceType: string;
	EC2SSHLocation: string;
	EC2PublicIPAddress: string;
	ECSClusterName: string;
	ECSCentralOrganizationID: string;
	ECSCentralEnvironmentName: string;
	ECSCentralDiscoveryAgentName: string;
	ECSCentralTraceabilityAgentName: string;
	ECSCentralClientID: string | null;
	ECSCentralRegion: string;
	DiscoveryAgentLogGroupName: string;
	DiscoveryAgentVersion: string;
	TraceabilityAgentLogGroupName: string;
	TraceabilityAgentVersion: string;
	SSMPrivateKeyParameter: string;
	SSMPublicKeyParameter: string;
	SecurityGroup: string;
	Subnet: string;

	constructor() {
		this.AgentResourcesBucket = '';
		this.APIGWCWRoleSetup = 'true';
		this.APIGWTrafficLogGroupName = 'aws-apigw-traffic-logs';
		this.DeploymentType = 'EC2';
		this.EC2VPCID = '';
		this.EC2KeyName = '';
		this.EC2InstanceType = 't3.micro';
		this.EC2SSHLocation = '0.0.0.0/0';
		this.EC2PublicIPAddress = 'true';
		this.ECSClusterName = '';
		this.ECSCentralOrganizationID = '';
		this.ECSCentralEnvironmentName = '';
		this.ECSCentralClientID = '';
		this.ECSCentralDiscoveryAgentName = '';
		this.ECSCentralTraceabilityAgentName = '';
		this.ECSCentralRegion = '';
		this.DiscoveryAgentLogGroupName = 'amplify-discovery-agent-logs';
		this.DiscoveryAgentVersion = 'latest';
		this.TraceabilityAgentLogGroupName = 'amplify-traceability-agent-logs';
		this.TraceabilityAgentVersion = 'latest';
		this.SSMPrivateKeyParameter = 'AmplifyPrivateKey';
		this.SSMPublicKeyParameter = 'AmplifyPublicKey';
		this.SecurityGroup = '';
		this.Subnet = '';
	}
}

export class IstioAgentValues {
	alsEnabled: boolean;
	alsMode: string;
	apicDeployment: string;
	envoyFilterNamespace: string;
	clientId: string;
	clusterName: string;
	keysSecretName: string;
	discoveryEnabled: boolean;
	namespace: { name: string; isNew: boolean };
	discoveryNamespaces: string[];
	// The extra Overrides listed below are not used in the actual hybridTemplate
	demoSvcEnabled: boolean;
	constructor() {
		this.alsEnabled = false;
		this.alsMode = 'default';
		this.apicDeployment = '';
		this.envoyFilterNamespace = '';
		this.clientId = '';
		this.clusterName = '';
		this.keysSecretName = 'amplify-agents-keys';
		this.discoveryEnabled = true;
		this.namespace = { name: '', isNew: false };
		this.demoSvcEnabled = false;
		this.discoveryNamespaces = [];
	}
}

export class IstioInstallValues {
	alsNamespace: string;
	certSecretName?: string;
	enableAls: boolean;
	enableTracing: boolean;
	envoyFilterNamespace: string;
	host?: string;
	isNewInstall: boolean;
	port?: number;
	protocol?: string;
	profile?: string;
	targetPort?: number;
	// The extra IstioOverrides listed below are not used in the actual istioOverrideTemplate
	certificateOption: string;
	constructor() {
		this.alsNamespace = 'amplify-agents';
		this.certificateOption = '';
		this.enableAls = false;
		this.enableTracing = false;
		this.envoyFilterNamespace = 'istio-system';
		this.host = '';
		this.isNewInstall = true;
		this.port = 8080;
		this.profile = 'demo';
		this.protocol = Protocol.HTTP;
		this.targetPort = 0;
	}
}

export enum TraceableRegionType {
	US = 'US',
	US1 = 'US-1',
	EU = 'EU',
	APAC = 'APAC',
	APAC2 = 'APAC-2',
	Canada = 'Canada',
	UAE = 'UAE',
}
