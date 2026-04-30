import { CentralAgentConfig, TraceabilityConfig } from '../../../types.js';
import hbs from 'handlebars';

/**
 * @description Parameters to provide to the Akamai handlebars templates.
 */
export class AkamaiAgentValues {
	namespace: { name: string; isNew: boolean };
	baseUrl: string;
	clientId: string;
	clientSecret: string;
	segmentLength: number;
	environments: string[];
	centralEnvironments: string[];
	centralConfig: CentralAgentConfig;
	traceabilityConfig: TraceabilityConfig;
	akamaiSecret: string;
	agentKeysSecret: string;

	constructor() {
		this.namespace = { name: '', isNew: false };
		this.baseUrl = '';
		this.clientId = '';
		this.clientSecret = '';
		this.segmentLength = 1;
		this.environments = [];
		this.centralEnvironments = [];
		this.centralConfig = new CentralAgentConfig();
		this.traceabilityConfig = new TraceabilityConfig();
		this.akamaiSecret = '';
		this.agentKeysSecret = '';
	}
}

hbs.registerHelper('formatIndex', (index: number) => {
	return index + 1;
});

/**
 * @description Generates the helm override file for the Amplify Akamai Agent.
 */
export const akamaiHelmOverrideTemplate = () => {
	return `---
# Akamai Agent image overrides
# image:
#   fullPath:
#   registry: docker.repository.axway.com
#   repository: ampc-beano-docker-prod/1.1
#   name: akamai-agent
#   tag:
#   pullPolicy: IfNotPresent
#   pullSecret:

akamai:
  baseUrl: {{baseUrl}}
  clientId: {{clientId}}
  clientSecret: {{clientSecret}}
  segmentLength: {{segmentLength}}
  {{#compare . environments.length 0 operator="!=" }}
  {{#environments}}
  akamai_environmentmapping_akamai_{{formatIndex @index}}={{.}}
  akamai_environmentmapping_amplify_{{formatIndex @index}}={{lookup ../centralEnvironments @index}}
  {{/environments}}
  {{/compare}}

env:
  CENTRAL_REGION: {{centralConfig.region}}
  CENTRAL_ORGANIZATIONID: "{{centralConfig.orgId}}"
  CENTRAL_TEAM: {{centralConfig.ampcTeamName}}
  CENTRAL_ENVIRONMENT: {{centralConfig.environment}}
  CENTRAL_AGENTNAME: {{centralConfig.caAgentName}}
  CENTRAL_AUTH_CLIENTID: {{centralConfig.dosaAccount.clientId}}
`;
};

/**
 * @description Generates the Amplify Akamai Agent env vars file.
 */
export const akamaiEnvVarTemplate = () => {
	return `# Akamai configs
AKAMAI_BASEURL={{baseUrl}}
AKAMAI_CLIENTID={{clientId}}
AKAMAI_CLIENTSECRET={{clientSecret}}
AKAMAI_SEGMENTLENGTH={{segmentLength}}
{{#compare . environments.length 0 operator="!=" }}
{{#environments}}
AKAMAI_ENVIRONMENTMAPPING_AKAMAI_{{formatIndex @index}}={{.}}
AKAMAI_ENVIRONMENTMAPPING_AMPLIFY_{{formatIndex @index}}={{lookup ../centralEnvironments @index}}
{{/environments}}
{{/compare}}

# Amplify Central configs
CENTRAL_AGENTNAME={{centralConfig.caAgentName}}
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
