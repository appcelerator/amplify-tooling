import { amplifyAgentsCredsSecret, amplifyAgentsKeysSecret } from '../index.js';
import { CentralAgentConfig, TraceabilityConfig } from '../../../types.js';

/**
 * @description Values to provide to the v7 handlebars templates.
 */
export class V7AgentValues {
	amplifyAgentCreds: string;
	amplifyAgentKeys: string;
	apiGatewayAuthPass: string;
	apiGatewayAuthUser: string;
	apiGatewayHost: string;
	apiGatewayPort: string;
	apiManagerAuthPass: string;
	apiManagerAuthUser: string;
	apiManagerHost: string;
	apiManagerPort: string;
	eventLogPath: string;
	eventLogPathTemplate: string;
	isGatewayOnly: boolean;
	isOpenTraffic: boolean;
	namespace: { name: string; isNew: boolean };
	centralConfig: CentralAgentConfig;
	traceabilityConfig: TraceabilityConfig;
	daVersion: string;
	taVersion: string;

	constructor() {
		this.amplifyAgentCreds = amplifyAgentsCredsSecret;
		this.amplifyAgentKeys = amplifyAgentsKeysSecret;
		this.apiGatewayAuthPass = '';
		this.apiGatewayAuthUser = '';
		this.apiGatewayHost = '';
		this.apiGatewayPort = '';
		this.apiManagerAuthPass = '';
		this.apiManagerAuthUser = '';
		this.apiManagerHost = '';
		this.apiManagerPort = '';
		this.eventLogPath = '';
		this.eventLogPathTemplate = '';
		this.isGatewayOnly = false;
		this.isOpenTraffic = false;
		this.namespace = { name: '', isNew: false };
		this.centralConfig = new CentralAgentConfig();
		this.traceabilityConfig = new TraceabilityConfig();
		this.daVersion = '';
		this.taVersion = '';
	}
}

/**
 * @description Generates the V7 TA env vars file.
 */
export const v7TAEnvVarTemplate = () => {
	return `{{#unless isGatewayOnly}}
# API Manager configs
APIMANAGER_AUTH_PASSWORD={{apiManagerAuthPass}}
APIMANAGER_AUTH_USERNAME={{apiManagerAuthUser}}
APIMANAGER_HOST={{apiManagerHost}}
APIMANAGER_PORT={{apiManagerPort}}
{{/unless}}
{{#if isGatewayOnly}}
APIGATEWAY_ONLY={{isGatewayOnly}}
{{/if}}
{{#if traceabilityConfig.usageReportingOffline}}
APIGATEWAY_GETHEADERS=false
{{else}}
{{#unless isOpenTraffic}}
# API Gateway configs
APIGATEWAY_AUTH_PASSWORD={{apiGatewayAuthPass}}
APIGATEWAY_AUTH_USERNAME={{apiGatewayAuthUser}}
APIGATEWAY_HOST={{apiGatewayHost}}
APIGATEWAY_PORT={{apiGatewayPort}}
{{/unless}}
{{/if}}
{{#if eventLogPathTemplate}}
{{#if isOpenTraffic}}
# API Gateway open traffic logs
EVENT_LOG_INPUT=false
OPENTRAFFIC_LOG_INPUT=true
OPENTRAFFIC_LOG_PATHS={{eventLogPathTemplate}}
{{else}}

# API Gateway event logs
EVENT_LOG_PATHS={{eventLogPathTemplate}}
{{/if}}
{{/if}}

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
{{#compare . centralConfig.ampcTeamName "" operator="!=" }}
CENTRAL_TEAM={{centralConfig.ampcTeamName}}
{{/compare}}
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
 * @description Generates the V7 TA helm overrides.
 */
export const v7TAHelmOverrideTemplate = () => {
	return `---
replicaCount: 1

# Traceability Agent image overrides
# image:
#   fullPath:
#   registry: docker.repository.axway.com
#   repository: ampc-beano-docker-prod/1.2
#   name: v7-traceability-agent
#   tag: "{{taVersion}}"
#   pullPolicy: IfNotPresent
#   pullSecret:

imagePullSecrets: []
nameOverride: ""
fullnameOverride: ""

# Health Check port
statusPort: 8990

# The following links document the environment variables for traceability.
# https://docs.axway.com/bundle/amplify-central/page/docs/connect_manage_environ/connect_api_manager/agent-variables/index.html#common-variables-to-both-agents
# https://docs.axway.com/bundle/amplify-central/page/docs/connect_manage_environ/connect_api_manager/agent-variables/index.html#specific-variables-for-traceability-agent
env:
  LOG_LEVEL: info 
  CENTRAL_AGENTNAME: {{centralConfig.taAgentName}}
  CENTRAL_REGION: {{centralConfig.region}}
  CENTRAL_AUTH_CLIENTID: {{centralConfig.dosaAccount.clientId}}
  CENTRAL_ORGANIZATIONID: "{{centralConfig.orgId}}"
  CENTRAL_ENVIRONMENT: {{centralConfig.environment}}
  CENTRAL_TEAM: "{{centralConfig.ampcTeamName}}"
  {{#if isOpenTraffic}}
  # API Gateway open traffic logs
  EVENT_LOG_INPUT: false
  OPENTRAFFIC_LOG_INPUT: true
  OPENTRAFFIC_LOG_PATHS: /events/*.log
  {{else}}
  # API Gateway event logs
  EVENT_LOG_PATHS: /events/*.log
  {{/if}}
  
  {{#if isGatewayOnly}}
  APIGATEWAY_ONLY: {{isGatewayOnly}}
  {{else}}
  APIMANAGER_HOST: {{apiManagerHost}}
  APIMANAGER_PORT: {{apiManagerPort}}
  # flip to true if API manager is using a self signed certificate
  APIMANAGER_SSL_INSECURESKIPVERIFY: false
  {{/if}}
  {{#if isOpenTraffic}}
  {{else}}
  APIGATEWAY_HOST: {{apiGatewayHost}}
  APIGATEWAY_PORT: {{apiGatewayPort}}
  # flip to true if API manager is using a self signed certificate
  APIGATEWAY_SSL_INSECURESKIPVERIFY: false
  APIGATEWAY_HEALTHCHECKPORT: 8090
  APIGATEWAY_HEALTHCHECKPROTOCOL: "https"
  APIGATEWAY_HEALTHCHECKURI: login
  {{/if}}

# The below secret are a pre-requisite. Please refer to the readme file for more info on it.
secrets:
  credentials: {{amplifyAgentCreds}}
  keys: {{amplifyAgentKeys}}

podAnnotations:

podSecurityContext:
  supplementalGroups: [ 2500 ]
  fsGroupChangePolicy: "OnRootMismatch"

securityContext:

tolerations:

affinity:

nodeSelector: {}

# Add additional labels to the agent deployment which may be required based on your configuration
additionalLabels:

serviceAccount:
  # Specifies whether a service account should be created
  create: true
  # The name of the service account to use.
  # If not set and create is true, a name is generated using the fullname template
  name:

resources: {}
  # We usually recommend not to specify default resources and to leave this as a conscious
  # choice for the user. This also increases chances charts run on environments with little
  # resources, such as Minikube. If you do want to specify resources, uncomment the following
  # lines, adjust them as necessary, and remove the curly braces after 'resources:'.
  # limits:
  #   cpu: 100m
  #   memory: 128Mi
  # requests:
  #   cpu: 100m
  #   memory: 128Mi

persistentVolumeClaimConfig:
  data:
    # storage class to persist contents of data directory in the agent - should be available in the cluster i.e gp2, gp2-csi, default
    storageClass: gp2-csi
    name: data-claim
  events:
    # update this value to match the name of the volume claim that is used for the event logs
    name: events-claim
`;
};

/**
 * @description Generates the V7 DA env vars file.
 */
export const v7DAEnvVarTemplate = () => {
	return `# API Manager configs
APIMANAGER_AUTH_USERNAME={{apiManagerAuthUser}}
APIMANAGER_AUTH_PASSWORD={{apiManagerAuthPass}}
APIMANAGER_HOST={{apiManagerHost}}
APIMANAGER_PORT={{apiManagerPort}}

# Amplify Central configs
CENTRAL_AGENTNAME={{centralConfig.daAgentName}}
CENTRAL_AUTH_CLIENTID={{centralConfig.dosaAccount.clientId}}
CENTRAL_AUTH_PRIVATEKEY={{centralConfig.dosaAccount.templatePrivateKey}}
CENTRAL_AUTH_PUBLICKEY={{centralConfig.dosaAccount.templatePublicKey}}
CENTRAL_ENVIRONMENT={{centralConfig.environment}}
CENTRAL_ORGANIZATIONID={{centralConfig.orgId}}
{{#compare . centralConfig.ampcTeamName "" operator="!=" }}
CENTRAL_TEAM={{centralConfig.ampcTeamName}}
{{/compare}}
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
 * @description Generates the V7 DA helm overrides.
 */
export const v7DAHelmOverrideTemplate = () => {
	return `---
replicaCount: 1

# Discovery Agent image overrides
# image:
#   fullPath:
#   registry: docker.repository.axway.com
#   repository: ampc-beano-docker-prod/1.2
#   name: v7-discovery-agent
#   tag: "{{daVersion}}"
#   pullPolicy: IfNotPresent
#   pullSecret:

nameOverride: ""
fullnameOverride: ""

# Health Check port
statusPort: 8989

# The following links document the environment variables for discovery.
# https://docs.axway.com/bundle/amplify-central/page/docs/connect_manage_environ/connect_api_manager/agent-variables/index.html#common-variables-to-both-agents
# https://docs.axway.com/bundle/amplify-central/page/docs/connect_manage_environ/connect_api_manager/agent-variables/index.html#specific-variables-for-discovery-agent
env:
  LOG_LEVEL: info
  CENTRAL_AGENTNAME: {{centralConfig.daAgentName}}
  CENTRAL_REGION: {{centralConfig.region}}
  CENTRAL_AUTH_CLIENTID: {{centralConfig.dosaAccount.clientId}}
  CENTRAL_ORGANIZATIONID: "{{centralConfig.orgId}}"
  CENTRAL_ENVIRONMENT: {{centralConfig.environment}}
  CENTRAL_TEAM: "{{centralConfig.ampcTeamName}}"
  APIMANAGER_HOST: {{apiManagerHost}}
  APIMANAGER_PORT: {{apiManagerPort}}
  # flip to true if API manager is using a self signed certificate
  APIMANAGER_SSL_INSECURESKIPVERIFY: false

# The below secret are a pre-requisite. Please refer to the readme file for more info on it.
secrets:
  credentials: {{amplifyAgentCreds}}
  keys: {{amplifyAgentKeys}}

podAnnotations:

podSecurityContext:
  supplementalGroups: [ 2500 ]
  fsGroupChangePolicy: "OnRootMismatch"

securityContext:

tolerations:

affinity:

nodeSelector: {}

# Add additional labels to the agent deployment which may be required based on your configuration
additionalLabels:

serviceAccount:
  # Specifies whether a service account should be created
  create: true
  # The name of the service account to use.
  # If not set and create is true, a name is generated using the fullname template
  name:

resources: {}
  # We usually recommend not to specify default resources and to leave this as a conscious
  # choice for the user. This also increases chances charts run on environments with little
  # resources, such as Minikube. If you do want to specify resources, uncomment the following
  # lines, adjust them as necessary, and remove the curly braces after 'resources:'.
  # limits:
  #   cpu: 100m
  #   memory: 128Mi
  # requests:
  #   cpu: 100m
  #   memory: 128Mi
`;
};
