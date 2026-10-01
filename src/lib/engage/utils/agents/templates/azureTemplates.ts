import { CentralAgentConfig, TraceabilityConfig } from '../../../types.js';

/**
 * @description Parameters to provide to the Azure handlebars templates.
 */
export class AzureAgentValues {
	apiManagementServiceName: string;
	eventHubName: string;
	eventHubNamespace: string;
	policyKey: string;
	policyName: string;
	resourceGroupName: string;
	servicePrincipalClientId: string;
	servicePrincipalClientSecret: string;
	subscriptionId: string;
	tenantId: string;
	isAzureEventHub: boolean;
	centralConfig: CentralAgentConfig;
	traceabilityConfig: TraceabilityConfig;

	constructor() {
		this.apiManagementServiceName = '';
		this.eventHubName = '';
		this.eventHubNamespace = '';
		this.policyKey = '';
		this.policyName = '';
		this.resourceGroupName = '';
		this.servicePrincipalClientId = '';
		this.servicePrincipalClientSecret = '';
		this.subscriptionId = '';
		this.tenantId = '';
		this.isAzureEventHub = false;
		this.centralConfig = new CentralAgentConfig();
		this.traceabilityConfig = new TraceabilityConfig();
	}
}

/**
 * @description Generates the Azure TA env vars file.
 */
export const azureTAEnvVarTemplate = () => {
	return `# Azure configs
AZURE_EVENTHUBNAME={{eventHubName}}
AZURE_EVENTHUBNAMESPACE={{eventHubNamespace}}
AZURE_SHAREDACCESSKEYNAME={{policyName}}
AZURE_SHAREDACCESSKEYVALUE={{policyKey}}
AZURE_TENANTID={{tenantId}}
AZURE_SUBSCRIPTIONID={{subscriptionId}}
AZURE_RESOURCEGROUPNAME={{resourceGroupName}}
AZURE_CLIENTID={{servicePrincipalClientId}}
AZURE_CLIENTSECRET={{servicePrincipalClientSecret}}
AZURE_APIMSERVICENAME={{apiManagementServiceName}}

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
 * @description Generates the Azure DA env vars file.
 */
export const azureDAEnvVarTemplate = () => {
	return `# Azure configs
AZURE_TENANTID={{tenantId}}
AZURE_SUBSCRIPTIONID={{subscriptionId}}
AZURE_RESOURCEGROUPNAME={{resourceGroupName}}
AZURE_CLIENTID={{servicePrincipalClientId}}
AZURE_CLIENTSECRET={{servicePrincipalClientSecret}}
{{#if isAzureEventHub}}
AZURE_EVENTHUBNAMESPACE={{eventHubNamespace}}
{{else}}
AZURE_APIMSERVICENAME={{apiManagementServiceName}}
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
