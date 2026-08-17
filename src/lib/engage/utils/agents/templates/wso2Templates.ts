import { CentralAgentConfig, TraceabilityConfig } from '../../../types.js';

/**
 * @description Parameters to provide to the WSO2 handlebars templates.
 */
export class WSO2AgentValues {
	wso2BaseURL: string;
	wso2ClientID: string;
	wso2ClientSecret: string;
	centralConfig: CentralAgentConfig;
	traceabilityConfig: TraceabilityConfig;

	constructor() {
		this.wso2BaseURL = '';
		this.wso2ClientID = '';
		this.wso2ClientSecret = '';
		this.centralConfig = new CentralAgentConfig();
		this.traceabilityConfig = new TraceabilityConfig();
	}
}

/**
 * @description Generates the WSO2 DA env vars file.
 */
export const wso2DAEnvVarTemplate = () => {
	return `# WSO2 configs
WSO2_BASEURL={{wso2BaseURL}}
WSO2_CLIENTID={{wso2ClientID}}
WSO2_CLIENTSECRET={{wso2ClientSecret}}

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
 * @description Generates the WSO2 TA env vars file.
 */
export const wso2TAEnvVarTemplate = () => {
	return `# WSO2 configs - For TA, there are no WSO2 environment variables

# Amplify Central configs
CENTRAL_AGENTNAME={{centralConfig.taAgentName}}
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
