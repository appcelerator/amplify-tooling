import { CentralAgentConfig, TraceabilityConfig } from '../../../types.js';

/**
 * @description Parameters to provide to the IBM API Connect handlebars templates.
 */
export class IBMAPIConnectAgentValues {
	apiConnectURL: string;
	apiConnectOrgName: string;
	apiConnectCatalogName: string;
	apiConnectAuthAPIKey: string;
	apiConnectAuthClientID: string;
	apiConnectAuthClientSecret: string;
	apiConnectConsumerOrgOwnerUser: string;
	apiConnectConsumerOrgOwnerRegistry: string;
	apiConnectAnalyticsServerName: string;
	centralConfig: CentralAgentConfig;
	traceabilityConfig: TraceabilityConfig;

	constructor() {
		this.apiConnectURL = '';
		this.apiConnectOrgName = '';
		this.apiConnectCatalogName = '';
		this.apiConnectAuthAPIKey = '';
		this.apiConnectAuthClientID = '';
		this.apiConnectAuthClientSecret = '';
		this.apiConnectConsumerOrgOwnerUser = '';
		this.apiConnectConsumerOrgOwnerRegistry = '';
		this.apiConnectAnalyticsServerName = '';
		this.centralConfig = new CentralAgentConfig();
		this.traceabilityConfig = new TraceabilityConfig();
	}
}

/**
 * @description Generates the IBM API Connect DA env vars file.
 */
export const ibmAPIConnectDAEnvVarTemplate = () => {
	return `# IBM API Connect configs
APICONNECT_URL={{apiConnectURL}}
APICONNECT_ORGANIZATIONNAME={{apiConnectOrgName}}
APICONNECT_CATALOGNAME={{apiConnectCatalogName}}
APICONNECT_AUTH_APIKEY={{apiConnectAuthAPIKey}}
APICONNECT_AUTH_CLIENTID={{apiConnectAuthClientID}}
APICONNECT_AUTH_CLIENTSECRET={{apiConnectAuthClientSecret}}
APICONNECT_CONSUMERORGOWNER_USER={{apiConnectConsumerOrgOwnerUser}}
APICONNECT_CONSUMERORGOWNER_REGISTRY={{apiConnectConsumerOrgOwnerRegistry}}

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

/**
 * @description Generates the IBM API Connect TA env vars file.
 */
export const ibmAPIConnectTAEnvVarTemplate = () => {
	return `# IBM API Connect configs
APICONNECT_URL={{apiConnectURL}}
APICONNECT_ORGANIZATIONNAME={{apiConnectOrgName}}
APICONNECT_CATALOGNAME={{apiConnectCatalogName}}
APICONNECT_AUTH_APIKEY={{apiConnectAuthAPIKey}}
APICONNECT_AUTH_CLIENTID={{apiConnectAuthClientID}}
APICONNECT_AUTH_CLIENTSECRET={{apiConnectAuthClientSecret}}
APICONNECT_ANALYTICSSERVERNAME={{apiConnectAnalyticsServerName}}

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
