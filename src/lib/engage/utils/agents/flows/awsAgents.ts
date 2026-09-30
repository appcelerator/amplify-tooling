import chalk from 'chalk';
import logger from '../../../../logger.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BasePaths, BundleType, GatewayTypes, InstallationFlowMethods, PublicDockerRepoBaseUrl, YesNo, YesNoChoices } from '../../../types.js';
import { askInput, askList, validateInputLength, validateRegex } from '../../basic-prompts.js';
import { dockerLoginMsg, isWindows, writeTemplates } from '../../utils.js';
import { AWSAgentValues } from '../index.js';
import * as helpers from '../index.js';

const debugLog = logger('lib: engage: utils: agents: flows: awsAgents');
const STAGE_TAG_NAME_LENGTH = 127;

// DeploymentTypes - ways the agents may be deployed with an AWS APIGW setup
export enum DeploymentTypes {
	EC2 = 'EC2',
	ECS_FARGATE = 'ECS Fargate',
	OTHER = 'Other',
}

const InvalidMsg = {
	S3_BUCKET: 'S3 Bucket Name can contain digits \'0-9\', lower case letters \'a-z\', hyphens \'-\', and periods \'.\' with 3-63 characters. Must begin and end with number or letter',
	LOG_GROUP: 'Log Group Name can contain digits \'0-9\', letters \'a-z\' and \'A-Z\', underscores \'_\', hyphens \'-\', forward slash \'/\', and periods \'.\' with a maximum length of 512 characters',
	SQS_QUEUE: 'SQS Queue Name can contain digits \'0-9\', letters \'a-z\' and \'A-Z\', underscores \'_\', and hyphens \'-\' with a maximum length of 80 characters',
	CLUSTER_NAME: 'ECS fargate cluster name can contain digits \'0-9\', letters \'a-z\' and \'A-Z\', underscores \'_\', and hyphens \'-\' with a maximum length of 255 characters',
};

// ConfigFiles - all the config file that are used in the setup
export const ConfigFiles = {
	DAEnvVars: `${helpers.configFiles.DA_ENV_VARS}`,
	TAEnvVars: `${helpers.configFiles.TA_ENV_VARS}`,
};

// AWSPrompts - all prompts to the user for input
export const AWSPrompts = {
	APIGW_LOG_GROUP: 'Enter the Log Group name to track API Gateway traffic events',
	STAGE_TAG_NAME: 'Enter the name of the tag on AWS API Gateway Stage that holds mapped stage on Amplify Engage',
	FULL_TRANSACTION_LOGGING: 'Do you want to enable Full Transaction Logging? Please note that CloudWatch costs would increase when Full Transaction Logging is enabled',
	AGENT_CORE_GATEWAY_MODE: 'Do you want to enable AgentCore Gateway Mode? (If not, the default will be to run the agent in API Gateway mode)',
	AGENT_CORE_LOG_GROUP_PREFIX: 'Enter the prefix for the AgentCore Gateway vendored logs',
	AGENT_CORE_IAM_AUTH: 'Do you want to enable IAM Authentication for AgentCore Gateway requests?',
	ENTER_MORE_COGNITO_USER_POOL_IDS: 'Do you want to enter another Cognito User Pool ID for AgentCore Gateway mode?',
	COGNITO: 'Enter the List of AWS Cognito user pool IDs used for authentication in AgentCore Gateway mode',
	COGNITO_USER_POOL_ID: 'Enter the User Pool ID for the Cognito User Pool the AgentCore will use for authentication',
	AGENTCORE_CLOUDTRAILENABLED: 'Do you want to enable CloudTrail-based consumer attribution for Cognito gateway?',
	AGENTCORE_CLOUDTRAILBUCKET: 'Enter the name of the S3 bucket that stores the CloudTrail data-event logs'
};

export const askBundleType = async (): Promise<BundleType> => {
	return BundleType.ALL_AGENTS;
};

export const askConfigType = async (): Promise<AgentConfigTypes> => {
	return AgentConfigTypes.DOCKERIZED;
};

export const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<AWSAgentValues> => {
	installConfig.log('\nCONNECTION TO AWS:');
	installConfig.log(
		chalk.gray(
			'You need credentials for executing the AWS CLI commands.\n'
				+ 'The Discovery Agent needs to connect to the Amazon (AWS) API Gateway to discover API\'s for publishing to Amplify.\n'
				+ 'The Traceability Agent needs to connect to the AWS API Gateway for the collection of transaction headers.\n'
				+ 'These headers will be formatted and forwarded to the Business Insights.\n'
				+ 'We recommend to use two different set of credentials: one for AWS CLI and one for the agents'
		)
	);

	const awsAgentValues: helpers.AWSAgentValues = new helpers.AWSAgentValues();
	installConfig.log(
		chalk.gray('To access the AWS CLI, the AWS Access Key and AWS Secret Key credentials are required.\n')
	);

	// AWS Region
	awsAgentValues.region = await helpers.askAWSRegion();

	// Determine gateway mode early to skip irrelevant API GW prompts
	awsAgentValues.agentCoreGatewayMode = (await askList({
		msg: AWSPrompts.AGENT_CORE_GATEWAY_MODE,
		default: YesNo.No,
		choices: YesNoChoices,
	})) === YesNo.Yes;

	if (awsAgentValues.agentCoreGatewayMode) {
		awsAgentValues.agentCore.iamAuthEnabled = (await askList({
			msg: AWSPrompts.AGENT_CORE_IAM_AUTH,
			default: YesNo.No,
			choices: YesNoChoices,
		})) === YesNo.Yes;
		installConfig.log(chalk.gray(AWSPrompts.COGNITO));
		const cognitoUserPoolIDs: string[] = [];
		let askCognitoUserPools = true;

		while (askCognitoUserPools) {
			const userPoolId = (await askInput({
				msg: AWSPrompts.COGNITO_USER_POOL_ID,
			})) as string;

			cognitoUserPoolIDs.push(userPoolId);

			askCognitoUserPools = await askList({
				msg: AWSPrompts.ENTER_MORE_COGNITO_USER_POOL_IDS,
				choices: YesNoChoices,
				default: YesNo.No,
			}) === YesNo.Yes;
		}

		awsAgentValues.cognitoUserPoolIDs = cognitoUserPoolIDs;
		if (installConfig.switches.isTaEnabled) {
			awsAgentValues.agentCore.logGroupPrefix = (await askInput({
				msg: AWSPrompts.AGENT_CORE_LOG_GROUP_PREFIX,
				defaultValue: awsAgentValues.agentCore.logGroupPrefix !== '' ? awsAgentValues.agentCore.logGroupPrefix : undefined,
				allowEmptyInput: true,
			})) as string;

			awsAgentValues.agentCore.cloudTrailEnabled = (await askList({
				msg: AWSPrompts.AGENTCORE_CLOUDTRAILENABLED,
				default: YesNo.No,
				choices: YesNoChoices,
			})) === YesNo.Yes;

			awsAgentValues.agentCore.cloudTrailBucket = (await askInput({
				msg: AWSPrompts.AGENTCORE_CLOUDTRAILBUCKET,
				defaultValue: awsAgentValues.agentCore.cloudTrailBucket !== '' ? awsAgentValues.agentCore.cloudTrailBucket : undefined,
				allowEmptyInput: false,
			})) as string;
		}
	} else {
		// API Gateway mode — collect all API GW-specific configuration
		const apiGWTrafficLogGroupName = (await askInput({
			msg: AWSPrompts.APIGW_LOG_GROUP,
			defaultValue: awsAgentValues.logGroup,
			validate: validateRegex(helpers.AWSRegexPatterns.AWS_REGEXP_LOG_GROUP_NAME, InvalidMsg.LOG_GROUP),
		})) as string;
		awsAgentValues.logGroup = apiGWTrafficLogGroupName;

		awsAgentValues.stageTagName = (await askInput({
			msg: AWSPrompts.STAGE_TAG_NAME,
			validate: validateInputLength(STAGE_TAG_NAME_LENGTH, 'Maximum length of \'stage tag name\' is 127'),
		})) as string;

		awsAgentValues.fullTransactionLogging = ((await askList({
			msg: AWSPrompts.FULL_TRANSACTION_LOGGING,
			choices: YesNoChoices,
			default: YesNo.No,
		})) === YesNo.Yes);

	}

	return awsAgentValues;
};

const generateOutput = async (installConfig: AgentInstallConfig): Promise<string> => {
	const daImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${installConfig.dockerRepoVersion}/${AgentNames.AWS_DA}`;
	const taImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${installConfig.dockerRepoVersion}/${AgentNames.AWS_TA}`;
	let dockerEnvConfig = '';
	let runCommands = '';

	const info = `To utilize the agents, pull the latest Docker images and run them using the appropriate supplied environment files, (${helpers.configFiles.DA_ENV_VARS} & ${helpers.configFiles.TA_ENV_VARS}):`;

	dockerEnvConfig = `
  - Add "AccessKeyId" & "SecretAccessKey" variables to both agent .env files, ${ConfigFiles.DAEnvVars} & ${
		ConfigFiles.TAEnvVars
	}:
    AWS_AUTH_ACCESSKEY=${chalk.yellow('Your_AccessKeyId')}
    AWS_AUTH_SECRETKEY=${chalk.yellow('Your_SecretAccessKey')}`;
	runCommands = `${chalk.whiteBright(info)}
${dockerLoginMsg()}
Pull the latest image of the Discovery Agent:
${chalk.cyan(`docker pull ${daImage}:${installConfig.daVersion}`)}

Pull the latest image of the Traceability Agent:
${chalk.cyan(`docker pull ${taImage}:${installConfig.taVersion}`)}
${
	isWindows
		? `
Start the Discovery agent on Windows machine (cmd.exe):
${chalk.cyan(
	`docker run --env-file ${helpers.pwdWin}/${ConfigFiles.DAEnvVars} -v ${helpers.pwdWin}:/keys ${helpers.eolCharWin}
	-v /data ${daImage}:${installConfig.daVersion}`
)}`
		: `
Start the Discovery agent on Linux based machine:
${chalk.cyan(
	`docker run --env-file ${helpers.pwd}/${ConfigFiles.DAEnvVars} -v ${helpers.pwd}:/keys ${helpers.eolChar}
	-v /data ${daImage}:${installConfig.daVersion}`
)}`
}
${
	isWindows
		? `
Start the Traceability agent on Windows machine (cmd.exe):
${chalk.cyan(
	`docker run --env-file ${helpers.pwdWin}/${ConfigFiles.TAEnvVars} -v ${helpers.pwdWin}:/keys ${helpers.eolCharWin}
	-v /data ${taImage}:${installConfig.taVersion}`
)}`
		: `
Start the Traceability agent on Linux based machine:
${chalk.cyan(
	`docker run --env-file ${helpers.pwd}/${ConfigFiles.TAEnvVars} -v ${helpers.pwd}:/keys ${helpers.eolChar}
	-v /data ${taImage}:${installConfig.taVersion}`
)}`
}`;

	return `
${dockerEnvConfig}

${runCommands}

${chalk.gray(`Additional information about agent features can be found here:\n${helpers.agentsDocsUrl.AWS}`)}\n
`;
};

export const completeInstall = async (installConfig: AgentInstallConfig): Promise<void> => {
	/**
	 * Create agent resources
	 */
	const awsAgentValues = installConfig.gatewayConfig as helpers.AWSAgentValues;

	// Add final settings to awsAgentsValues
	awsAgentValues.centralConfig = installConfig.centralConfig;
	awsAgentValues.traceabilityConfig = installConfig.traceabilityConfig;

	installConfig.log('\nCreating the agent environment files for AWS...');

	if (
		installConfig.switches.isDaEnabled
	) {
		debugLog.log('GENERATING DA TEMPLATE');
		writeTemplates(ConfigFiles.DAEnvVars, awsAgentValues, helpers.awsDAEnvVarTemplate);
	}

	if (
		installConfig.switches.isTaEnabled
	) {
		debugLog.log('GENERATING TA TEMPLATE');
		writeTemplates(ConfigFiles.TAEnvVars, awsAgentValues, helpers.awsTAEnvVarTemplate);
	}

	installConfig.log('Configuration file(s) have been successfully created.\n');

	installConfig.log(await generateOutput(installConfig));
};

export const AWSInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: [
		ConfigFiles.DAEnvVars,
		ConfigFiles.TAEnvVars,
	],
	AgentNameMap: {
		[AgentTypes.da]: AgentNames.AWS_DA,
		[AgentTypes.ta]: AgentNames.AWS_TA,
	},
	GatewayDisplay: GatewayTypes.AWS_GATEWAY,
};
