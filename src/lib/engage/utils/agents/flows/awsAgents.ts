import chalk from 'chalk';
import fs from 'fs';
import logger from '../../../../logger.js';
import { dataService } from '../../../../request.js';
import { InstallationFlowMethods } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, AWSRegions, BasePaths, BundleType, GatewayTypes, PublicDockerRepoBaseUrl, PublicRepoUrl, TrueFalse, YesNo, YesNoChoices } from '../../../types.js';
import { askInput, askList, validateInputLength, validateRegex } from '../../basic-prompts.js';
import { isWindows, writeTemplates, writeToFile } from '../../utils.js';
import { AWSAgentValues } from '../index.js';
import * as helpers from '../index.js';
import { Account } from '../../../../../types.js';

const { log } = logger('lib: engage: utils: agents: flows: awsAgents');
const daImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.AWS_DA}`;
const taImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.AWS_TA}`;
const STAGE_TAG_NAME_LENGTH = 127;

// DeploymentTypes - ways the agents may be deployed with an AWS APIGW setup
export enum DeploymentTypes {
	EC2 = 'EC2',
	ECS_FARGATE = 'ECS Fargate',
	OTHER = 'Other',
}

// EC2InstanceTypes - instance types allowed in cloud formation document
enum EC2InstanceTypes {
	T3_MICRO = 't3.micro',
	T3_NAN0 = 't3.nano',
	T3_SMALL = 't3.small',
	T3_MEDIUM = 't3.medium',
	T3_LARGE = 't3.large',
	T3_XLARGE = 't3.xlarge',
	T3_2XLARGE = 't3.2xlarge',
}

const InvalidMsg = {
	S3_BUCKET: 'S3 Bucket Name can contain digits \'0-9\', lower case letters \'a-z\', hyphens \'-\', and periods \'.\' with 3-63 characters. Must begin and end with number or letter',
	LOG_GROUP: 'Log Group Name can contain digits \'0-9\', letters \'a-z\' and \'A-Z\', underscores \'_\', hyphens \'-\', forward slash \'/\', and periods \'.\' with a maximum length of 512 characters',
	SQS_QUEUE: 'SQS Queue Name can contain digits \'0-9\', letters \'a-z\' and \'A-Z\', underscores \'_\', and hyphens \'-\' with a maximum length of 80 characters',
	CLUSTER_NAME: 'ECS fargate cluster name can contain digits \'0-9\', letters \'a-z\' and \'A-Z\', underscores \'_\', and hyphens \'-\' with a maximum length of 255 characters',
};

// ConfigFiles - all the config file that are used in the setup
export const ConfigFiles = {
	DeployAllYAML: 'amplify-agents-deploy-all.yaml',
	ResourcesYAML: 'amplify-agents-setup.yaml',
	EC2DeployYAML: 'amplify-agents-ec2.yaml',
	FargateDeployYAML: 'amplify-agents-ecs-fargate.yaml',
	AgentConfigZip: 'aws_apigw_agent_config-latest.zip',
	DAEnvVars: `${helpers.configFiles.DA_ENV_VARS}`,
	TAEnvVars: `${helpers.configFiles.TA_ENV_VARS}`,
	CFProperties: 'cloudformation_properties.json',
};

// AWSPrompts - all prompts to the user for input
export const AWSPrompts = {
	APIGW_LOG_GROUP: 'Enter the Log Group name to track API Gateway traffic events',
	CLUSTER_NAME: 'Enter the ECS fargate cluster name to deploy the ECS task for the agents',
	CONFIG_BUCKET: 'Enter the S3 bucket the config service will use to track config changes',
	CONFIG_BUCKET_EXISTS: 'Does this bucket already exist on AWS, or will you create beforehand?',
	CONFIG_SERVICE: 'Do you want to setup config service?',
	DA_LOG_GROUP: 'Enter the log group name the discovery agent will log to',
	STAGE_TAG_NAME: 'Enter the name of the tag on AWS API Gateway Stage that holds mapped stage on Amplify Engage',
	DA_QUEUE: 'Enter the discovery queue name',
	DEPLOYMENT: 'Select the type of deployment you wish to configure',
	EC2_TYPE: 'Select the EC2 instance type',
	KEY_PAIR: 'Enter the EC2 KeyPair name that will be used to connect via SSH to the EC2 instance',
	PUBLIC_IP: 'Assign a Public IP Address to this, only change if your VPC has a NAT Gateway',
	SECURITY_GROUP: 'Enter the Security Group for the EC2 Instance of ECS Container',
	SETUP_APIGW_CW:
		'The Amazon API Gateway service requires a role to write usage logs to Cloud Watch. Do you want to configure that?',
	SSH_LOCATION: 'Enter the IP address range that can be used to SSH to the EC2 instances',
	SSM_PRIVATE: 'Enter the name of the SSM Parameter holding the Private Key',
	SSM_PUBLIC: 'Enter the name of the SSM Parameter holding the Public Key',
	SUBNET: 'Enter the Subnet for the EC2 Instance of ECS Container',
	S3_BUCKET: 'Enter the existing S3 bucket, within your region, where the agent resources will be uploaded',
	TA_LOG_GROUP: 'Enter the log group name the traceability agent will log to',
	FULL_TRANSACTION_LOGGING: 'Do you want to enable Full Transaction Logging? Please note that CloudWatch costs would increase when Full Transaction Logging is enabled',
	TA_QUEUE: 'Enter the traceability queue name',
	VPC_ID: 'Enter the VPC ID to deploy the EC2 instance to. Leave blank to create entire infrastructure',
};

export const askBundleType = async (): Promise<BundleType> => {
	return BundleType.ALL_AGENTS;
};

export const askConfigType = async (): Promise<AgentConfigTypes> => {
	return AgentConfigTypes.DOCKERIZED;
};

//
// Complex prompts
//
const askDeployment = async (): Promise<string> => {
	return askList({
		msg: AWSPrompts.DEPLOYMENT,
		choices: [
			{ name: DeploymentTypes.EC2, value: DeploymentTypes.EC2 },
			{ name: DeploymentTypes.ECS_FARGATE, value: DeploymentTypes.ECS_FARGATE },
			{ name: 'Docker Container Only', value: DeploymentTypes.OTHER },
		],
		default: DeploymentTypes.EC2,
	});
};

// askToCreateRoleSetup - asks a Yes/No question for creating the APIGW IAM role, returns a True/False string for CloudFormation parameters
const askToCreateRoleSetup = async (): Promise<string> => {
	return (await askList({
		msg: AWSPrompts.SETUP_APIGW_CW,
		choices: YesNoChoices,
		default: YesNo.Yes,
	})) === YesNo.Yes
		? TrueFalse.True.toLowerCase()
		: TrueFalse.False.toLowerCase();
};

// askToUsePublicIpAddress - asks a Yes/No question for setting a public IP address, returns a True/False string for CloudFormation parameters
const askToUsePublicIpAddress = async (): Promise<string> => {
	return (await askList({
		msg: AWSPrompts.PUBLIC_IP,
		choices: YesNoChoices,
		default: YesNo.Yes,
	})) === YesNo.Yes
		? TrueFalse.True.toLowerCase()
		: TrueFalse.False.toLowerCase();
};

const askEC2InstanceType = async (): Promise<string> => {
	return await askList({
		msg: AWSPrompts.EC2_TYPE,
		choices: [
			{ name: EC2InstanceTypes.T3_MICRO, value: EC2InstanceTypes.T3_MICRO },
			{ name: EC2InstanceTypes.T3_NAN0, value: EC2InstanceTypes.T3_NAN0 },
			{ name: EC2InstanceTypes.T3_SMALL, value: EC2InstanceTypes.T3_SMALL },
			{ name: EC2InstanceTypes.T3_MEDIUM, value: EC2InstanceTypes.T3_MEDIUM },
			{ name: EC2InstanceTypes.T3_LARGE, value: EC2InstanceTypes.T3_LARGE },
			{ name: EC2InstanceTypes.T3_XLARGE, value: EC2InstanceTypes.T3_XLARGE },
			{ name: EC2InstanceTypes.T3_2XLARGE, value: EC2InstanceTypes.T3_2XLARGE },
		],
		default: EC2InstanceTypes.T3_MICRO,
	});
};

const askEC2VPCConfig = async (awsAgentValues: helpers.AWSAgentValues): Promise<helpers.AWSAgentValues> => {
	awsAgentValues.cloudFormationConfig.EC2VPCID = (await askInput({
		msg: AWSPrompts.VPC_ID,
		allowEmptyInput: true,
		validate: validateRegex(
			helpers.AWSRegexPatterns.AWS_REGEXP_VPC_ID,
			helpers.invalidValueExampleErrMsg('VPC ID', 'vpc-xxxxxxxxxx')
		),
	})) as string;

	if (awsAgentValues.cloudFormationConfig.EC2VPCID !== '') {
		// EC2 Public IP Address
		awsAgentValues.cloudFormationConfig.EC2PublicIPAddress = await askToUsePublicIpAddress();
		await askSecurityGroupAndSubnet(awsAgentValues);
	}

	return awsAgentValues;
};

const askSecurityGroupAndSubnet = async (awsAgentValues: helpers.AWSAgentValues): Promise<helpers.AWSAgentValues> => {
	awsAgentValues.cloudFormationConfig.SecurityGroup = (await askInput({
		msg: AWSPrompts.SECURITY_GROUP,
		validate: validateRegex(
			helpers.AWSRegexPatterns.AWS_REGEXP_SECURITY_GROUP,
			helpers.invalidValueExampleErrMsg('security group', 'sg-xxxxxxxxxx')
		),
	})) as string;

	awsAgentValues.cloudFormationConfig.Subnet = (await askInput({
		msg: AWSPrompts.SUBNET,
		validate: validateRegex(
			helpers.AWSRegexPatterns.AWS_REGEXP_SUBNET,
			helpers.invalidValueExampleErrMsg('subnet ID', 'subnet-xxxxxxxxxx')
		),
	})) as string;

	return awsAgentValues;
};

async function configureEC2Deployment(awsAgentValues: helpers.AWSAgentValues): Promise<helpers.AWSAgentValues> {
	// EC2 Instance type
	awsAgentValues.cloudFormationConfig.EC2InstanceType = await askEC2InstanceType();

	// EC2 Key Name
	console.log(
		chalk.gray(
			'A SSH key pair is required to access the EC2 instance. An example CLI command will be given at the end, if needed'
		)
	);
	awsAgentValues.cloudFormationConfig.EC2KeyName = (await askInput({ msg: AWSPrompts.KEY_PAIR })) as string;

	// EC2 VPC Config
	awsAgentValues = await askEC2VPCConfig(awsAgentValues);

	awsAgentValues.cloudFormationConfig.EC2SSHLocation = (await askInput({
		msg: AWSPrompts.SSH_LOCATION,
		defaultValue: awsAgentValues.cloudFormationConfig.EC2SSHLocation,
		validate: validateRegex(
			helpers.AWSRegexPatterns.AWS_REGEXP_SSH_LOCATION,
			helpers.invalidValueExampleErrMsg('IP Range/Mask', '1.2.3.4/0')
		),
	})) as string;

	// SSMPrivateKeyParameter
	awsAgentValues.cloudFormationConfig.SSMPrivateKeyParameter = (await askInput({
		msg: AWSPrompts.SSM_PRIVATE,
		defaultValue: awsAgentValues.cloudFormationConfig.SSMPrivateKeyParameter,
	})) as string;

	// SSMPublicKeyParameter
	awsAgentValues.cloudFormationConfig.SSMPublicKeyParameter = (await askInput({
		msg: AWSPrompts.SSM_PUBLIC,
		defaultValue: awsAgentValues.cloudFormationConfig.SSMPublicKeyParameter,
	})) as string;

	return awsAgentValues;
}

async function configureECSDeployment(awsAgentValues: helpers.AWSAgentValues): Promise<helpers.AWSAgentValues> {
	// ECS Cluster name
	awsAgentValues.cloudFormationConfig.ECSClusterName = (await askInput({
		msg: AWSPrompts.CLUSTER_NAME,
		validate: validateRegex(helpers.AWSRegexPatterns.AWS_REGEXP, InvalidMsg.CLUSTER_NAME),
	})) as string;

	awsAgentValues = await askSecurityGroupAndSubnet(awsAgentValues);
	// SSMPrivateKeyParameter
	awsAgentValues.cloudFormationConfig.SSMPrivateKeyParameter = (await askInput({
		msg: AWSPrompts.SSM_PRIVATE,
		defaultValue: awsAgentValues.cloudFormationConfig.SSMPrivateKeyParameter,
	})) as string;

	// SSMPublicKeyParameter
	awsAgentValues.cloudFormationConfig.SSMPublicKeyParameter = (await askInput({
		msg: AWSPrompts.SSM_PUBLIC,
		defaultValue: awsAgentValues.cloudFormationConfig.SSMPublicKeyParameter,
	})) as string;
	return awsAgentValues;
}

export const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<AWSAgentValues> => {
	console.log('\nCONNECTION TO AMAZON API GATEWAY:');
	console.log(
		chalk.gray(
			'You need credentials for executing the AWS CLI commands.\n'
				+ 'The Discovery Agent needs to connect to the Amazon (AWS) API Gateway to discover API\'s for publishing to Amplify.\n'
				+ 'The Traceability Agent needs to connect to the AWS API Gateway for the collection of transaction headers.\n'
				+ 'These headers will be formatted and forwarded to the Business Insights.\n'
				+ 'We recommend to use two different set of credentials: one for AWS CLI and one for the agents'
		)
	);

	// DeploymentType
	const deploymentType = await askDeployment();
	let awsAgentValues: helpers.AWSAgentValues = new helpers.AWSAgentValues(deploymentType);
	awsAgentValues.cloudFormationConfig.DeploymentType = deploymentType;
	switch (awsAgentValues.cloudFormationConfig.DeploymentType) {
		case DeploymentTypes.ECS_FARGATE: {
			console.log(
				chalk.gray(
					'To deploy the Agents to ECS Fargate you will need an ECS Cluster Name, Security Group, and Subnet. The coming questions will ask those values.\n'
				)
			);
			break;
		}
		case DeploymentTypes.OTHER: {
			console.log(
				chalk.gray('To access the AWS CLI, the AWS Access Key and AWS Secret Key credentials are required.\n')
			);
			break;
		}
	}

	// AWS Region
	awsAgentValues.region = await helpers.askAWSRegion();

	// S3 bucket
	awsAgentValues.cloudFormationConfig.AgentResourcesBucket = (await askInput({
		msg: AWSPrompts.S3_BUCKET,
		validate: validateRegex(helpers.AWSRegexPatterns.AWS_REGEXP, InvalidMsg.S3_BUCKET),
	})) as string;

	// APIGWCWRoleSetup
	awsAgentValues.cloudFormationConfig.APIGWCWRoleSetup = await askToCreateRoleSetup();

	// APIGWTrafficLogGroupName
	const apiGWTrafficLogGroupName = (await askInput({
		msg: AWSPrompts.APIGW_LOG_GROUP,
		defaultValue: awsAgentValues.cloudFormationConfig.APIGWTrafficLogGroupName,
		validate: validateRegex(helpers.AWSRegexPatterns.AWS_REGEXP_LOG_GROUP_NAME, InvalidMsg.LOG_GROUP),
	})) as string;
	awsAgentValues.logGroup = apiGWTrafficLogGroupName;
	awsAgentValues.cloudFormationConfig.APIGWTrafficLogGroupName = apiGWTrafficLogGroupName;

	// StageTagName
	const stageTagName = (await askInput({
		msg: AWSPrompts.STAGE_TAG_NAME,
		validate: validateInputLength(STAGE_TAG_NAME_LENGTH, 'Maximum length of \'stage tag name\' is 127'),
	})) as string;
	awsAgentValues.stageTagName = stageTagName;

	// FullTransactionLogging
	const fullTransactionLogging = ((await askList({
		msg: AWSPrompts.FULL_TRANSACTION_LOGGING,
		choices: YesNoChoices,
		default: YesNo.No,
	})) === YesNo.Yes);

	awsAgentValues.fullTransactionLogging = fullTransactionLogging;

	// set agent versions
	awsAgentValues.cloudFormationConfig.DiscoveryAgentVersion = installConfig.daVersion;
	awsAgentValues.cloudFormationConfig.TraceabilityAgentVersion = installConfig.taVersion;

	// Configure appropriate Gateway type
	switch (awsAgentValues.cloudFormationConfig.DeploymentType) {
		case DeploymentTypes.ECS_FARGATE: {
			awsAgentValues = await configureECSDeployment(awsAgentValues);
			break;
		}
		case DeploymentTypes.EC2: {
			awsAgentValues = await configureEC2Deployment(awsAgentValues);
			break;
		}
	}

	// DiscoveryAgentLogGroupName
	awsAgentValues.cloudFormationConfig.DiscoveryAgentLogGroupName = (await askInput({
		msg: AWSPrompts.DA_LOG_GROUP,
		defaultValue: awsAgentValues.cloudFormationConfig.DiscoveryAgentLogGroupName,
		validate: validateRegex(helpers.AWSRegexPatterns.AWS_REGEXP_LOG_GROUP_NAME, InvalidMsg.LOG_GROUP),
	})) as string;

	// TraceabilityAgentLogGroupName
	awsAgentValues.cloudFormationConfig.TraceabilityAgentLogGroupName = (await askInput({
		msg: AWSPrompts.TA_LOG_GROUP,
		defaultValue: awsAgentValues.cloudFormationConfig.TraceabilityAgentLogGroupName,
		validate: validateRegex(helpers.AWSRegexPatterns.AWS_REGEXP_LOG_GROUP_NAME, InvalidMsg.LOG_GROUP),
	})) as string;

	return awsAgentValues;
};

const generateOutput = async (installConfig: AgentInstallConfig): Promise<string> => {
	const awsAgentValues = installConfig.gatewayConfig as helpers.AWSAgentValues;
	const s3BaseFiles = [ ConfigFiles.DeployAllYAML, ConfigFiles.ResourcesYAML ];
	let additionalSteps = '';
	let dockerEnvConfig = '';
	let runCommands = '';
	// Configure appropriate Gateway type
	switch (awsAgentValues.cloudFormationConfig.DeploymentType) {
		case DeploymentTypes.ECS_FARGATE: {
			// DeploymentTypes.ECS_FARGATE
			s3BaseFiles.push(ConfigFiles.FargateDeployYAML);
			additionalSteps = `  - Create the SSM parameter:
${chalk.cyan(
	`    aws ssm put-parameter --type SecureString --name ${awsAgentValues.cloudFormationConfig.SSMPrivateKeyParameter} --value "file://private_key.pem"`
)}
${chalk.cyan(
	`    aws ssm put-parameter --type SecureString --name ${awsAgentValues.cloudFormationConfig.SSMPublicKeyParameter} --value "file://public_key.pem"`
)}`;
			// Cleanup EC2 file
			fs.unlinkSync(ConfigFiles.EC2DeployYAML);
			break;
		}
		case DeploymentTypes.OTHER: {
			// DeploymentTypes.OTHER for Docker Container Only
			// These files need to be put in a resources dir on S3
			let s3ResourcesIncludes = '';
			[ ConfigFiles.DAEnvVars, ConfigFiles.TAEnvVars ].forEach(
				(value) => (s3ResourcesIncludes += `--include "${value}" `)
			);

			// Cleanup EC2 file
			fs.unlinkSync(ConfigFiles.EC2DeployYAML);
			// Cleanup ECS Fargate file
			fs.unlinkSync(ConfigFiles.FargateDeployYAML);
			const info = `To utilize the agents, pull the latest Docker images and run them using the appropriate supplied environment files, (${helpers.configFiles.DA_ENV_VARS} & ${helpers.configFiles.TA_ENV_VARS}):`;

			dockerEnvConfig = `Wait for the CloudFormation Stack to complete.
  - Create AWS Access and Secret Keys and copy resulting ${chalk.yellow('"AccessKeyId"')} & ${chalk.yellow(
		'"SecretAccessKey"'
	)}:
${chalk.cyan(`    aws iam create-access-key  --user-name AxwayAmplifyAgentsUser-${awsAgentValues.region} ${helpers.eolChar}
	--query "AccessKey.{"AccessKeyId":AccessKeyId,"SecretAccessKey":SecretAccessKey}"`)}
  - Add "AccessKeyId" & "SecretAccessKey" variables to both agent .env files, ${ConfigFiles.DAEnvVars} & ${
		ConfigFiles.TAEnvVars
	}:
    AWS_AUTH_ACCESSKEY=${chalk.yellow('Your_AccessKeyId')}
    AWS_AUTH_SECRETKEY=${chalk.yellow('Your_SecretAccessKey')}`;
			runCommands = `${chalk.whiteBright(info)}

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
			break;
		}
		default: {
			// DeploymentTypes.EC2
			s3BaseFiles.push(ConfigFiles.EC2DeployYAML);
			// These files need to be put in a resources dir on S3
			let s3ResourcesIncludes = '';
			[ ConfigFiles.DAEnvVars, ConfigFiles.TAEnvVars ].forEach(
				(value) => (s3ResourcesIncludes += `--include "${value}" `)
			);
			additionalSteps = `${chalk.cyan(
				`    aws s3 sync --exclude "*" ${s3ResourcesIncludes} ./ s3://${awsAgentValues.cloudFormationConfig.AgentResourcesBucket}/resources`
			)}
  - If necessary, create EC2 KeyPair, for EC2 login:
${chalk.cyan(
	`    aws ec2 create-key-pair --key-name ${awsAgentValues.cloudFormationConfig.EC2KeyName} --query KeyMaterial --output text > MyKeyPair.pem`
)}
  - Create the SSM parameter:
${chalk.cyan(
	`    aws ssm put-parameter --type SecureString --name ${awsAgentValues.cloudFormationConfig.SSMPrivateKeyParameter} --value "file://private_key.pem"`
)}
${chalk.cyan(
	`    aws ssm put-parameter --type SecureString --name ${awsAgentValues.cloudFormationConfig.SSMPublicKeyParameter} --value "file://public_key.pem"`
)}`;
			// Cleanup Fargate file
			fs.unlinkSync(ConfigFiles.FargateDeployYAML);
			break;
		}
	}

	let s3BaseIncludes = '';
	s3BaseFiles.forEach((value) => (s3BaseIncludes += `--include "${value}" `));
	// if region is AWS default, 'us-east-1', region unnecessary in cloudformation template url
	const s3Region = awsAgentValues.region === AWSRegions.US_EAST_1 ? 's3' : `s3.${awsAgentValues.region}`;

	return `
To complete the install, run the following AWS CLI command:
  - Create, if necessary, and upload all files to your S3 bucket
${chalk.cyan(
	`    aws s3api create-bucket --bucket ${awsAgentValues.cloudFormationConfig.AgentResourcesBucket} --create-bucket-configuration LocationConstraint=${awsAgentValues.region}`
)}
${chalk.cyan(
	`    aws s3 sync --exclude "*" ${s3BaseIncludes} ./ s3://${awsAgentValues.cloudFormationConfig.AgentResourcesBucket}`
)}
${additionalSteps}
  - Deploy the CloudFormation Stack:
${chalk.cyan(`    aws cloudformation create-stack --stack-name AxwayAmplifyAgents ${helpers.eolChar}
        --template-url https://${awsAgentValues.cloudFormationConfig.AgentResourcesBucket}.${s3Region}.amazonaws.com/${ConfigFiles.DeployAllYAML} ${helpers.eolChar}
        --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND CAPABILITY_NAMED_IAM --parameters "file://${ConfigFiles.CFProperties}"`)} 
  - Check the CloudFormation Stack:
${chalk.cyan(`    aws cloudformation describe-stacks --stack-name AxwayAmplifyAgents ${helpers.eolChar}
	--query "Stacks[].{"Name":StackName,"Status":StackStatus}"`)}
${dockerEnvConfig}

${runCommands}

${chalk.gray(`Additional information about agent features can be found here:\n${helpers.agentsDocsUrl.AWS}`)}\n
`;
};

// Download latest aws apigw config zip
const downloadAPIGWAgentConfigZip = async (account: Account): Promise<string> => {
	const url = `${BasePaths.AWSAgents}/aws_apigw_agent_config/latest/${ConfigFiles.AgentConfigZip}`;

	const service = await dataService({
		account,
		baseUrl: PublicRepoUrl,
	});
	try {
		const { stream } = await service.download(url);
		await helpers.streamPipeline(stream, fs.createWriteStream(ConfigFiles.AgentConfigZip));
		return ConfigFiles.AgentConfigZip;
	} catch (err: any) {
		throw new Error(`Failed to download the agent: ${err.message}`);
	}
};

// Unzip latest aws apigw config zip
const unzipAPIGWAgentConfigZip = async (zipFile: string): Promise<boolean> => {
	await helpers.unzip(zipFile);
	fs.unlinkSync(zipFile);

	const isCloudFormation = fs.existsSync(ConfigFiles.DeployAllYAML);
	if (!isCloudFormation) {
		console.log(`${ConfigFiles.DeployAllYAML} was not extracted from ${ConfigFiles.AgentConfigZip}`);
		return false;
	}
	return true;
};

export const installPreprocess = async (installConfig: AgentInstallConfig): Promise<AgentInstallConfig> => {
	// attempt to download the cloud formation files
	console.log(chalk.gray('Downloading the latest Cloud formation template...'));
	const account = installConfig.centralConfig.apiServerClient?.account;
	if (!account) {
		throw new Error('Unable to resolve account for DataService call during AWS agent install preprocess');
	}
	const apigwAgentConfigZipFile = await downloadAPIGWAgentConfigZip(account);
	if (apigwAgentConfigZipFile !== '') {
		console.log(chalk.gray('\nSuccess'));
	}
	(installConfig.gatewayConfig as helpers.AWSAgentValues).apigwAgentConfigZipFile = apigwAgentConfigZipFile;
	return installConfig;
};

export const completeInstall = async (installConfig: AgentInstallConfig): Promise<void> => {
	/**
	 * Create agent resources
	 */
	const awsAgentValues = installConfig.gatewayConfig as helpers.AWSAgentValues;

	// Add final settings to awsAgentsValues
	awsAgentValues.centralConfig = installConfig.centralConfig;
	awsAgentValues.traceabilityConfig = installConfig.traceabilityConfig;

	const unpackZip = await unzipAPIGWAgentConfigZip(awsAgentValues.apigwAgentConfigZipFile);
	if (unpackZip) {
		console.log('\nCreating the agent environment files for AWS...');
	}

	console.log('Generating the configuration file(s)...');

	console.log('Generating the cloud formation parameters file...');
	const paramStrings = [];
	awsAgentValues.updateCloudFormationConfig();
	for (const [ key, value ] of Object.entries(awsAgentValues.cloudFormationConfig)) {
		paramStrings.push(`{"ParameterKey": "${key}", "ParameterValue": "${value}"}`);
	}
	writeToFile(ConfigFiles.CFProperties, `[\n${paramStrings.join(',\n')}\n]`);

	if (
		installConfig.switches.isDaEnabled
		&& DeploymentTypes.ECS_FARGATE !== awsAgentValues.cloudFormationConfig.DeploymentType
	) {
		log('GENERATING DA TEMPLATE');
		writeTemplates(ConfigFiles.DAEnvVars, awsAgentValues, helpers.awsDAEnvVarTemplate);
	}

	if (
		installConfig.switches.isTaEnabled
		&& DeploymentTypes.ECS_FARGATE !== awsAgentValues.cloudFormationConfig.DeploymentType
	) {
		log('GENERATING TA TEMPLATE');
		writeTemplates(ConfigFiles.TAEnvVars, awsAgentValues, helpers.awsTAEnvVarTemplate);
	}

	console.log('Configuration file(s) have been successfully created.\n');

	console.log(await generateOutput(installConfig));
};

export const AWSInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	InstallPreprocess: installPreprocess,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	AgentNameMap: {
		[AgentTypes.da]: AgentNames.AWS_DA,
		[AgentTypes.ta]: AgentNames.AWS_TA,
	},
	GatewayDisplay: GatewayTypes.AWS_GATEWAY,
};
