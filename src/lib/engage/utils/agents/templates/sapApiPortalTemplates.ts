import { CentralAgentConfig, TraceabilityConfig } from '../../../types.js';

/**
 * @description Parameters to provide to the SAP API Portal handlebars templates.
 */
export class SAPApiPortalAgentValues {
	authTokenURL: string;
	authAPIPortalBaseURL: string;
	authAPIPortalClientID: string;
	authAPIPortalClientSecret: string;
	authDevPortalBaseURL: string;
	authDevPortalClientID: string;
	authDevPortalClientSecret: string;
	developerEmail: string;
	specCreateUnstructuredAPI: boolean;
	centralConfig: CentralAgentConfig;
	traceabilityConfig: TraceabilityConfig;

	constructor() {
		this.authTokenURL = '';
		this.authAPIPortalBaseURL = '';
		this.authAPIPortalClientID = '';
		this.authAPIPortalClientSecret = '';
		this.authDevPortalBaseURL = '';
		this.authDevPortalClientID = '';
		this.authDevPortalClientSecret = '';
		this.developerEmail = '';
		this.specCreateUnstructuredAPI = false;
		this.centralConfig = new CentralAgentConfig();
		this.traceabilityConfig = new TraceabilityConfig();
	}
}

/**
 * @description Generates the SAP API Portal DA env vars file.
 */
export const sapAPIPortalDAEnvVarTemplate = () => {
	return `# SAP API Portal configs
SAP_AUTH_TOKENURL={{authTokenURL}}
SAP_AUTH_APIPORTAL_BASEURL={{authAPIPortalBaseURL}}
SAP_AUTH_APIPORTAL_CLIENTID={{authAPIPortalClientID}}
SAP_AUTH_APIPORTAL_CLIENTSECRET={{authAPIPortalClientSecret}}
SAP_AUTH_DEVPORTAL_BASEURL={{authDevPortalBaseURL}}
SAP_AUTH_DEVPORTAL_CLIENTID={{authDevPortalClientID}}
SAP_AUTH_DEVPORTAL_CLIENTSECRET={{authDevPortalClientSecret}}
SAP_DEVELOPEREMAIL={{developerEmail}}
SAP_SPEC_CREATEUNSTRUCTUREDAPI={{specCreateUnstructuredAPI}}

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
 * @description Generates the SAP API Portal TA env vars file.
 */
export const sapAPIPortalTAEnvVarTemplate = () => {
	return `# SAP API Portal configs
SAP_AUTH_TOKENURL={{authTokenURL}}
SAP_AUTH_APIPORTAL_BASEURL={{authAPIPortalBaseURL}}
SAP_AUTH_APIPORTAL_CLIENTID={{authAPIPortalClientID}}
SAP_AUTH_APIPORTAL_CLIENTSECRET={{authAPIPortalClientSecret}}

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
