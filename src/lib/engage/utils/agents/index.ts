import extract from 'extract-zip';
import stream from 'stream';
import util from 'util';

export const streamPipeline = util.promisify(stream.pipeline);

export const unzip = async (filePath: string): Promise<void> => {
	await extract(filePath, { dir: process.cwd() });
};

export const invalidValueExampleErrMsg = (resourceType: string, example: string) => {
	return `Invalid ${resourceType} entered. ${resourceType} must be in the form of ${example}`;
};

export const eolChar = '\\';
export const eolCharWin = '^';
export const pwd = '"$(pwd)"';
export const pwdWin = '"%cd%"';
export const amplifyAgentsKeysSecret = 'amplify-agents-keys';
export const amplifyAgentsCredsSecret = 'amplify-agents-credentials';

// configFiles - the agent config file names
export const configFiles = {
	DA_ENV_VARS: 'da_env_vars.env',
	TA_ENV_VARS: 'ta_env_vars.env',
	AGENT_ENV_VARS: 'agent_env_vars.env',
};

export const agentsDocsUrl = {
	V7: 'https://docs.axway.com/bundle/amplify-central/page/docs/connect_manage_environ/connect_api_manager/index.html',
	AKAMAI: 'https://docs.axway.com/bundle/amplify-central/page/docs/runtime_security/configure_runtime_compliance_akamai/index.html',
	APIGEEX: 'https://docs.axway.com/bundle/amplify-central/page/docs/connect_manage_environ/connect_apigeex_gateway/index.html',
	AWS: 'https://docs.axway.com/bundle/amplify-central/page/docs/connect_manage_environ/connect_aws_gateway/index.html',
	AZURE: 'https://docs.axway.com/bundle/amplify-central/page/docs/connect_manage_environ/connect_azure_gateway/index.html',
	ISTIO: 'https://docs.axway.com/bundle/amplify-central/page/docs/connect_manage_environ/mesh_management/index.html',
	GRAYLOG: 'https://docs.axway.com/bundle/amplify-central/page/docs/connect_manage_environ/mesh_management/index.html',
	IBMAPICONNECT: 'https://docs.axway.com/bundle/amplify-central/page/docs/connect_manage_environ/connect_ibm_api_connect/index.html',
	SOFTWAREAGWEBMETHODS: 'https://docs.axway.com/bundle/amplify-central/page/docs/connect_manage_environ/connect_software_ag_webmethods/index.html',
	TRACEABLE: 'https://docs.axway.com/bundle/amplify-central/page/docs/runtime_security/configure_runtime_compliance_traceable/index.html',
	BACKSTAGE: 'https://docs.axway.com/bundle/amplify-central/page/docs/connect_manage_environ/connect_backstage/index.html',
	SAPAPIPORTAL: 'https://docs.axway.com/bundle/amplify-central/page/docs/connect_manage_environ/connect_sap_api_portal/index.html',
	SENSEDIA: 'https://docs.axway.com/bundle/amplify-central/page/docs/connect_manage_environ/connect_sensedia/index.html',
	WSO2: 'https://docs.axway.com/bundle/amplify-central/page/docs/connect_manage_environ/connect_wso2_gateway/index.html',
};

export * from './deleters.js';
export * from './creators.js';
export * from './getters.js';
export * from './inputs.js';
export * from './regex.js';
export * from './templates/akamaiTemplates.js';
export * from './templates/apigeexTemplates.js';
export * from './templates/awsTemplates.js';
export * from './templates/azureTemplates.js';
export * from './templates/edgeTemplates.js';
export * from './templates/istioTemplates.js';
export * from './templates/gitLabTemplates.js';
export * from './templates/kafkaTemplates.js';
export * from './templates/graylogTemplates.js';
export * from './templates/ibmAPIConnectTemplates.js';
export * from './templates/softwareAGWebMethodsTemplates.js';
export * from './templates/sensediaTemplates.js';
export * from './templates/traceableTemplates.js';
