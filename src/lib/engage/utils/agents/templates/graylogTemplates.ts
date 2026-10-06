import { CentralAgentConfig, TraceabilityConfig } from '../../../types.js';

/**
 * @description Parameters to provide to the Graylog handlebars templates.
 */
export class GraylogAgentValues {
	namespace: { name: string; isNew: boolean };
	url: string;
	graylogSecret: string;
	agentKeysSecret: string;
	userName: string;
	password: string;
	basePathSegmentLen: number;
	centralConfig: CentralAgentConfig;
	traceabilityConfig: TraceabilityConfig;

	constructor() {
		this.namespace = { name: '', isNew: false };
		this.url = '';
		this.graylogSecret = '';
		this.agentKeysSecret = '';
		this.userName = '';
		this.password = '';
		this.basePathSegmentLen = 2;
		this.centralConfig = new CentralAgentConfig();
		this.traceabilityConfig = new TraceabilityConfig();
	}
}

/**
 * @description Generates the helm override file for the Amplify Graylog Agent.
 */
export const graylogHelmOverrideTemplate = () => {
	return `---
# Graylog Agent image overrides
# image:
#   fullPath:
#   registry: docker.repository.axway.com
#   repository: ampc-beano-docker-prod/1.1
#   name: graylog-agent
#   tag:
#   pullPolicy: IfNotPresent
#   pullSecret:

graylog:
  url: {{url}}
  basePathSegmentLen: {{basePathSegmentLen}}

secrets:
  graylog:
    name: {{graylogSecret}}
  agent:
    name: {{agentKeysSecret}}
  
env:
  CENTRAL_REGION: {{centralConfig.region}}
  CENTRAL_ORGANIZATIONID: "{{centralConfig.orgId}}"
  CENTRAL_TEAM: {{centralConfig.ampcTeamName}}
  CENTRAL_ENVIRONMENT: {{centralConfig.environment}}
  CENTRAL_AGENTNAME: {{centralConfig.caAgentName}}
  CENTRAL_AUTH_CLIENTID: {{centralConfig.dosaAccount.clientId}}
`;
};
