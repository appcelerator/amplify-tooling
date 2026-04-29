import {
	CentralAgentConfig,
	CloudFormationConfig,
	TraceabilityConfig,
} from '../../../types.js';

/**
 * @description Values to provide to the aws handlebars templates.
 */

export class AWSAgentValues {
	accessKey: string;
	secretKey: string;
	logGroup: string;
	stageTagName: string;
	fullTransactionLogging: boolean;
	region: string;
	apigwAgentConfigZipFile: string;
	centralConfig: CentralAgentConfig;
	traceabilityConfig: TraceabilityConfig;
	cloudFormationConfig: CloudFormationConfig;

	constructor(awsDeployment: string) {
		this.accessKey = awsDeployment === 'Other' ? '**Insert Access Key**' : '';
		this.secretKey = awsDeployment === 'Other' ? '**Insert Secret Key**' : '';
		this.logGroup = '';
		this.stageTagName = '';
		this.fullTransactionLogging = false;
		this.region = '';
		this.apigwAgentConfigZipFile = '';
		this.centralConfig = new CentralAgentConfig();
		this.traceabilityConfig = new TraceabilityConfig();
		this.cloudFormationConfig = new CloudFormationConfig();
	}

	updateCloudFormationConfig = () => {
		this.cloudFormationConfig.ECSCentralRegion = this.centralConfig.region;
		if (this.cloudFormationConfig.DeploymentType === 'ECS Fargate') {
			this.cloudFormationConfig.ECSCentralOrganizationID = this.centralConfig.orgId;
			this.cloudFormationConfig.ECSCentralEnvironmentName = this.centralConfig.environment;
			this.cloudFormationConfig.ECSCentralClientID = this.centralConfig.dosaAccount.clientId;
			this.cloudFormationConfig.ECSCentralDiscoveryAgentName = this.centralConfig.daAgentName;
			this.cloudFormationConfig.ECSCentralTraceabilityAgentName = this.centralConfig.taAgentName;
		}
	};
}

/**
 * @description Generates the AWS TA env vars file.
 */
export const awsTAEnvVarTemplate = () => {
	return `# AWS configs
AWS_REGION={{region}}
{{#if accessKey}}
AWS_AUTH_ACCESSKEY={{accessKey}}
{{/if}}
{{#if secretKey}}
AWS_AUTH_SECRETKEY={{secretKey}}
{{/if}}
{{#if fullTransactionLogging}}
AWS_FULLTRANSACTIONLOGGING={{fullTransactionLogging}}
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

/**
 * @description Generates the AWS DA env vars file.
 */
export const awsDAEnvVarTemplate = () => {
	return `# AWS configs
AWS_REGION={{region}}
{{#if accessKey}}
AWS_AUTH_ACCESSKEY={{accessKey}}
{{/if}}
{{#if secretKey}}
AWS_AUTH_SECRETKEY={{secretKey}}
{{/if}}
AWS_LOGGROUP={{logGroup}}
AWS_STAGETAGNAME={{stageTagName}}

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
