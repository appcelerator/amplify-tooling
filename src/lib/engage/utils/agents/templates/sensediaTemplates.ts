import { CentralAgentConfig, TraceabilityConfig } from '../../../types.js';

export enum SensediaAuthType {
	OAuth = 'OAuth Client ID and Client Secret',
	StaticToken = 'Static Token',
}

/**
 * @description Parameters to provide to the Sensedia handlebars templates.
 */
export class SensediaAgentValues {
	baseUrl: string;
	authType: string;
	clientId: string;
	clientSecret: string;
	authToken: string;
	developerEmail: string;
	environments: string[];
	centralConfig: CentralAgentConfig;
	traceabilityConfig: TraceabilityConfig;

	constructor() {
		this.baseUrl = '';
		this.authType = '';
		this.clientId = '';
		this.clientSecret = '';
		this.authToken = '';
		this.developerEmail = '';
		this.environments = [];
		this.centralConfig = new CentralAgentConfig();
		this.traceabilityConfig = new TraceabilityConfig();
	}
}

/**
 * @description Generates the Sensedia TA env vars file.
 */
export const sensediaTAEnvVarTemplate = () => {
	return `# Sensedia configs
SENSEDIA_BASEURL={{baseUrl}}
{{#if clientId}}
SENSEDIA_AUTH_CLIENTID={{clientId}}
SENSEDIA_AUTH_CLIENTSECRET={{clientSecret}}
{{/if}}
{{#if authToken}}
SENSEDIA_AUTH_TOKEN={{authToken}}
{{/if}}
{{#if environments.length}}
SENSEDIA_ENVIRONMENTS={{environments}}
{{/if}}

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
 * @description Generates the Sensedia DA env vars file.
 */
export const sensediaDAEnvVarTemplate = () => {
	return `# Sensedia configs
SENSEDIA_BASEURL={{baseUrl}}
{{#if clientId}}
SENSEDIA_AUTH_CLIENTID={{clientId}}
SENSEDIA_AUTH_CLIENTSECRET={{clientSecret}}
{{/if}}
{{#if authToken}}
SENSEDIA_AUTH_TOKEN={{authToken}}
{{/if}}
SENSEDIA_DEVELOPEREMAIL={{developerEmail}}
{{#if environments.length}}
SENSEDIA_ENVIRONMENTS={{environments}}
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
