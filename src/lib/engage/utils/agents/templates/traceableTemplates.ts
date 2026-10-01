import { CentralAgentConfig, TraceabilityConfig, TraceableRegionType } from '../../../types.js';
import hbs from 'handlebars';

export class ComplianceAgentValues {
	centralEnvironments: string[];

	constructor() {
		this.centralEnvironments = [];
	}
}

/**
 * @description Parameters to provide to the Traceable handlebars templates.
 */
export class TraceableAgentValues extends ComplianceAgentValues {
	namespace: { name: string; isNew: boolean };
	traceableToken: string;
	traceableRegion: TraceableRegionType;
	environments: string[];
	centralConfig: CentralAgentConfig;
	traceabilityConfig: TraceabilityConfig;
	traceableSecret: string;
	agentKeysSecret: string;

	constructor() {
		super();
		this.namespace = { name: '', isNew: false };
		this.traceableToken = '';
		this.traceableRegion = TraceableRegionType.US;
		this.environments = [];
		this.centralConfig = new CentralAgentConfig();
		this.traceabilityConfig = new TraceabilityConfig();
		this.traceableSecret = '';
		this.agentKeysSecret = '';
	}
}

hbs.registerHelper('formatIndex', (index: number) => {
	return index + 1;
});

/**
 * @description Generates the helm override file for the Amplify Traceable Agent.
 */
export const traceableHelmOverrideTemplate = () => {
	return `---
# Traceable Agent image overrides
# image:
#   fullPath:
#   registry: docker.repository.axway.com
#   repository: ampc-beano-docker-prod/1.1
#   name: graylog-agent
#   tag:
#   pullPolicy: IfNotPresent
#   pullSecret:

secrets:
  traceable:
    name: {{traceableSecret}}
  agent:
    name: {{agentKeysSecret}}

traceable:
  token: {{traceableToken}}
  {{#compare . environments.length 0 operator="!=" }}
  {{#environments}}
  traceable_environmentmapping_traceable_{{formatIndex @index}}={{.}}
  {{/environments}}
  {{/compare}}
  {{#compare . centralEnvironments.length 0 operator="!=" }}
  {{#centralEnvironments}}
  traceable_environmentmapping_amplify_{{formatIndex @index}}={{.}}
  {{/centralEnvironments}}
  {{/compare}}
  region: {{traceableRegion}}

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
 * @description Generates the Amplify Traceable Agent env vars file.
 */
export const traceableEnvVarTemplate = () => {
	return `# Traceable configs
TRACEABLE_TOKEN={{traceableToken}}
TRACEABLE_REGION={{traceableRegion}}
{{#compare . environments.length 0 operator="!=" }}
{{#environments}}
TRACEABLE_ENVIRONMENTMAPPING_TRACEABLE_{{formatIndex @index}}={{.}}
{{/environments}}
{{/compare}}
{{#compare . centralEnvironments.length 0 operator="!=" }}
{{#centralEnvironments}}
TRACEABLE_ENVIRONMENTMAPPING_AMPLIFY_{{formatIndex @index}}={{.}}
{{/centralEnvironments}}
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
