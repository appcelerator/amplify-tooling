import {
	CentralAgentConfig,
	TraceabilityConfig,
} from '../../../types.js';

/**
 * @description Values to provide to the Software AG WebMethods handlebars templates.
 */

export class SoftwareAGWebMethodsAgentValues {
	pathURL: string;
	pathUsername: string;
	pathPassword: string;
	pathOauth2Server: string;
	centralConfig: CentralAgentConfig;
	traceabilityConfig: TraceabilityConfig;

	constructor() {
		this.pathURL = '';
		this.pathUsername = '';
		this.pathPassword = '';
		this.pathOauth2Server = 'local';
		this.centralConfig = new CentralAgentConfig();
		this.traceabilityConfig = new TraceabilityConfig();
	}
}

/**
 * @description Generates the Software AG WebMethods TA env vars file.
 */
export const softwareAGWebMethodsTAEnvVarTemplate = () => {
	return `# Software AG WebMethods configs
WEBMETHODS_URL={{pathURL}}
WEBMETHODS_AUTH_USERNAME={{pathUsername}}
WEBMETHODS_AUTH_PASSWORD={{pathPassword}}
WEBMETHODS_OAUTH2SERVER={{pathOauth2Server}}

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

/**
 * @description Generates the Software AG WebMethods DA env vars file.
 */
export const softwareAGWebMethodsDAEnvVarTemplate = () => {
	return `# Software AG WebMethods configs
WEBMETHODS_URL={{pathURL}}
WEBMETHODS_AUTH_USERNAME={{pathUsername}}
WEBMETHODS_AUTH_PASSWORD={{pathPassword}}
WEBMETHODS_OAUTH2SERVER={{pathOauth2Server}}

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
