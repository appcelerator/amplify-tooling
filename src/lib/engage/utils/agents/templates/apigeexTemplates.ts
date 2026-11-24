import { ApigeeMetricsFilterConfig, APIGEEXDISCOVERYMODES, CentralAgentConfig, GeminiAgentPlatformConfig, TraceabilityConfig } from '../../../types.js';

/**
 * @description Parameters to provide to the Apigee X handlebars templates.
 */
export class ApigeeXAgentValues {
	projectId: string;
	developerEmailAddress: string;
	mode: APIGEEXDISCOVERYMODES;
	geminiAgentPlatformMode: boolean;
	geminiAgentPlatform: GeminiAgentPlatformConfig;
	environment: string;
	fileName: string;
	metricsFilter: ApigeeMetricsFilterConfig;
	centralConfig: CentralAgentConfig;
	traceabilityConfig: TraceabilityConfig;

	constructor() {
		this.projectId = '';
		this.developerEmailAddress = '';
		this.mode = APIGEEXDISCOVERYMODES.PROXY;
		this.geminiAgentPlatformMode = false;
		this.geminiAgentPlatform = new GeminiAgentPlatformConfig();
		this.environment = '';
		this.fileName = '';
		this.metricsFilter = new ApigeeMetricsFilterConfig(true, []);
		this.centralConfig = new CentralAgentConfig();
		this.traceabilityConfig = new TraceabilityConfig();
	}
}

/**
 * @description Generates the ApigeeX TA env vars file.
 */
export const apigeeXTAEnvVarTemplate = () => {
	return `# ApigeeX configs
APIGEE_PROJECTID={{projectId}}
APIGEE_DEVELOPEREMAIL={{developerEmailAddress}}
APIGEE_MODE={{mode}}
{{#unless geminiAgentPlatformMode}}
APIGEE_ENVIRONMENT={{environment}}
{{/unless}}
APIGEE_AUTHFILEPATH=/keys/{{fileName}}
{{#unless geminiAgentPlatformMode}}
APIGEE_METRICSFILTER_FILTERMETRICS={{metricsFilter.filterMetrics}}
{{#if metricsFilter.filterMetrics}}
APIGEE_METRICSFILTER_FILTEREDAPIS={{metricsFilter.filteredAPIs}}
{{/if}}
{{/unless}}

# Amplify Central configs
{{#if traceabilityConfig.usageReportingOffline}}
CENTRAL_USAGEREPORTING_OFFLINE={{traceabilityConfig.usageReportingOffline}}
CENTRAL_ENVIRONMENTID={{centralConfig.environmentId}}
CENTRAL_AGENTNAME={{centralConfig.taAgentName}}
{{else}}
CENTRAL_AGENTNAME={{centralConfig.taAgentName}}
CENTRAL_AUTH_CLIENTID={{centralConfig.dosaAccount.clientId}}
CENTRAL_AUTH_PRIVATEKEY={{centralConfig.dosaAccount.templatePrivateKey}}
CENTRAL_AUTH_PUBLICKEY={{centralConfig.dosaAccount.templatePublicKey}}
CENTRAL_ENVIRONMENT={{centralConfig.environment}}
CENTRAL_ORGANIZATIONID={{centralConfig.orgId}}
CENTRAL_TEAM={{centralConfig.ampcTeamName}}
CENTRAL_REGION={{centralConfig.region}}

{{/if}}

# Logging configs
# Define the logging level: info, debug, error
LOG_LEVEL=info
# Specify where to send the log: stdout, file, both
LOG_OUTPUT=stdout
# Define where the log files are written
LOG_FILE_PATH=logs
`;
};

/**
 * @description Generates the ApigeeX DA env vars file.
 */
export const apigeeXDAEnvVarTemplate = () => {
	return `# ApigeeX configs
APIGEE_PROJECTID={{projectId}}
APIGEE_DEVELOPEREMAIL={{developerEmailAddress}}
APIGEE_MODE={{mode}}
{{#unless geminiAgentPlatformMode}}
APIGEE_ENVIRONMENT={{environment}}
{{/unless}}
APIGEE_AUTHFILEPATH=/keys/{{fileName}}
{{#if geminiAgentPlatformMode}}
{{#if geminiAgentPlatform.locations}}
APIGEE_GEMINIAGENTPLATFORM_LOCATIONS={{geminiAgentPlatform.locations}}
{{/if}}
{{#if geminiAgentPlatform.runtimes}}
APIGEE_GEMINIAGENTPLATFORM_RUNTIMES={{geminiAgentPlatform.runtimes}}
{{/if}}
{{#if geminiAgentPlatform.gateways}}
APIGEE_GEMINIAGENTPLATFORM_GATEWAYS={{geminiAgentPlatform.gateways}}
{{/if}}
APIGEE_GEMINIAGENTPLATFORM_MCPDISCOVERYENABLED={{geminiAgentPlatform.mcpDiscoveryEnabled}}
{{/if}}

# Amplify Central configs
CENTRAL_AGENTNAME={{centralConfig.daAgentName}}
CENTRAL_AUTH_CLIENTID={{centralConfig.dosaAccount.clientId}}
CENTRAL_AUTH_PRIVATEKEY={{centralConfig.dosaAccount.templatePrivateKey}}
CENTRAL_AUTH_PUBLICKEY={{centralConfig.dosaAccount.templatePublicKey}}
CENTRAL_ENVIRONMENT={{centralConfig.environment}}
CENTRAL_ORGANIZATIONID={{centralConfig.orgId}}
CENTRAL_TEAM={{centralConfig.ampcTeamName}}
CENTRAL_REGION={{centralConfig.region}}

# Logging configs
# Define the logging level: info, debug, error
LOG_LEVEL=info
# Specify where to send the log: stdout, file, both
LOG_OUTPUT=stdout
# Define where the log files are written
LOG_FILE_PATH=logs
`;
};
