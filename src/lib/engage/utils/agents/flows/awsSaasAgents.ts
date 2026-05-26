import chalk from 'chalk';
import logger from '../../../../logger.js';
import { ApiServerClient } from '../../../clients-external/apiserverclient.js';
import { DefinitionsManager } from '../../../results/DefinitionsManager.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BundleType, GatewayTypes, InstallationFlowMethods, SaaSGatewayTypes, YesNo, YesNoChoices } from '../../../types.js';
import { askInput, askList, validateInputLength, validateRegex } from '../../basic-prompts.js';
import * as helpers from '../index.js';
import {
	askFrequencyAndFilter,
	CompleteInstallContext,
	createAgentResources,
	createDataplaneResources,
	createIDPResources,
	DataplaneConfig,
	SaasAgentValues,
	setupEnvironment,
} from './saasAgentsBase.js';

const debugLog = logger('lib: engage: utils: agents: flows: awsSaasAgents');
const STAGE_TAG_NAME_LENGTH = 127;

class AWSDataplaneConfig extends DataplaneConfig {
	accessLogARN: string;
	fullTransactionLogging: boolean;
	stageTagName: string;

	constructor(arn: string, enableFullTransactionLogging: boolean, stageTagName: string) {
		super('AWS');
		this.accessLogARN = arn;
		this.fullTransactionLogging = enableFullTransactionLogging;
		this.stageTagName = stageTagName;
	}
}

enum AWSAuthType {
	ASSUME = 'Assume Role Policy',
	KEYS = 'Access and Secret Keys',
}

class SaasAWSAgentValues extends SaasAgentValues {
	authType: AWSAuthType;
	accessKey: string;
	secretKey: string;
	region: string;
	assumeRole: string;
	externalID: string;
	accessLogARN: string;
	fullTransactionLogging: boolean;
	stageTagName: string;

	constructor() {
		super();
		this.authType = AWSAuthType.ASSUME;
		this.accessKey = '';
		this.secretKey = '';
		this.region = '';
		this.assumeRole = '';
		this.externalID = '';
		this.accessLogARN = '';
		this.fullTransactionLogging = false;
		this.stageTagName = '';
	}

	override getAccessData(): string {
		if (this.authType === AWSAuthType.KEYS) {
			return JSON.stringify({
				region: this.region,
				accessKeyID: this.accessKey,
				secretAccessKey: this.secretKey,
			});
		}

		return JSON.stringify({
			region: this.region,
			roleARN: this.assumeRole,
			externalID: this.externalID,
		});
	}
}

const SaasPrompts = {
	AUTHENTICATION_TYPE: 'Authenticate with an AssumeRole Policy or an Access Key ID and Secret Access Key',
	ACCESS_KEY: 'Enter the AWS Access Key ID the agent will use',
	SECRET_KEY: 'Enter the AWS Secret Access Key the agent will use',
	ASSUME_ROLE: 'Enter the Role ARN that the agent will Assume',
	EXTERNAL_ID: 'Enter the External ID the Assume Role expects',
	ACCESS_LOG_ARN: 'Enter the ARN for the Access Log that the Discovery will add and the Traceability will use',
	STAGE_TAG_NAME: 'Enter the name of the tag on AWS API Gateway Stage that holds mapped stage on Amplify Engage',
	FULL_TRANSACTION_LOGGING: 'Do you want to enable Full Transaction Logging? Please note that CloudWatch costs would increase when Full Transaction Logging is enabled',
};

export const askBundleType = async (): Promise<BundleType> => {
	return (await askList({
		msg: 'Select the type of agent(s) you want to install',
		choices: [ BundleType.ALL_AGENTS, BundleType.DISCOVERY, BundleType.TRACEABILITY ],
	})) as BundleType;
};

export const askConfigType = async (): Promise<AgentConfigTypes> => {
	return AgentConfigTypes.HOSTED;
};

const askForAWSCredentials = async (agentValues: SaasAWSAgentValues, log: (text: string) => void = () => {}): Promise<SaasAWSAgentValues> => {
	agentValues.region = await helpers.askAWSRegion();
	debugLog.log('gathering access details for aws');

	agentValues.authType = (await askList({
		msg: SaasPrompts.AUTHENTICATION_TYPE,
		default: AWSAuthType.ASSUME,
		choices: [
			{ name: AWSAuthType.ASSUME, value: AWSAuthType.ASSUME },
			{ name: AWSAuthType.KEYS, value: AWSAuthType.KEYS },
		],
	})) as AWSAuthType;

	log(chalk.gray('Please refer to docs.axway.com for information on creating the necessary AWS IAM policies'));

	if (agentValues.authType === AWSAuthType.ASSUME) {
		debugLog.log('using an assume role policy authentication');
		agentValues.assumeRole = (await askInput({
			msg: SaasPrompts.ASSUME_ROLE,
			defaultValue: agentValues.assumeRole !== '' ? agentValues.assumeRole : undefined,
			validate: validateRegex(
				helpers.AWSRegexPatterns.AWS_REGEXP_ROLE_ARN,
				helpers.invalidValueExampleErrMsg('assume role arn', 'arn:aws:iam::000000000000:role/name-of-role')
			),
		})) as string;

		agentValues.externalID = (await askInput({
			msg: SaasPrompts.EXTERNAL_ID,
			defaultValue: agentValues.externalID !== '' ? agentValues.externalID : undefined,
			allowEmptyInput: true,
		})) as string;
	} else {
		debugLog.log('using key and secret authentication');
		agentValues.accessKey = (await askInput({
			msg: SaasPrompts.ACCESS_KEY,
			defaultValue: agentValues.accessKey !== '' ? agentValues.accessKey : undefined,
			validate: validateRegex(
				helpers.AWSRegexPatterns.AWS_REGEXP_ACCESS_KEY_ID,
				helpers.invalidValueExampleErrMsg('access key id', 'AKIAIOSFODNN7EXAMPLE')
			),
		})) as string;

		agentValues.secretKey = (await askInput({
			msg: SaasPrompts.SECRET_KEY,
			defaultValue: agentValues.secretKey !== '' ? agentValues.secretKey : undefined,
			validate: validateRegex(
				helpers.AWSRegexPatterns.AWS_REGEXP_SECRET_ACCESS_KEY,
				helpers.invalidValueExampleErrMsg('secret access key', 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')
			),
		})) as string;
	}

	return agentValues;
};

export const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<SaasAgentValues> => {
	installConfig.log('\nCONNECTION TO AMAZON API GATEWAY:');
	installConfig.log(
		chalk.gray(
			'The Discovery Agent needs to connect to the AWS API Gateway to discover API\'s for publishing to Amplify Engage'
		)
	);

	let agentValues: SaasAgentValues = new SaasAgentValues();

	if (installConfig.gatewayType === GatewayTypes.AWS_GATEWAY) {
		const awsValues = new SaasAWSAgentValues();
		agentValues = await askForAWSCredentials(awsValues, installConfig.log);

		awsValues.stageTagName = (await askInput({
			msg: SaasPrompts.STAGE_TAG_NAME,
			validate: validateInputLength(STAGE_TAG_NAME_LENGTH, 'Maximum length of \'stage tag name\' is 127'),
		})) as string;

		if (installConfig.switches.isTaEnabled) {
			installConfig.log(chalk.gray('\nThe access log ARN is a cloud watch log group amazon resource name'));
			awsValues.accessLogARN = (await askInput({
				msg: SaasPrompts.ACCESS_LOG_ARN,
				validate: validateRegex(
					helpers.AWSRegexPatterns.AWS_ACCESS_LOG_ARN,
					helpers.invalidValueExampleErrMsg('access log arn', 'arn:aws:logs:region:000000000000:log-group:log-group-name')
				),
			})) as string;

			awsValues.fullTransactionLogging = ((await askList({
				msg: SaasPrompts.FULL_TRANSACTION_LOGGING,
				default: YesNo.No,
				choices: YesNoChoices,
			})) as YesNo) === YesNo.Yes;
		}
	}

	agentValues = await askFrequencyAndFilter(agentValues, installConfig);

	return agentValues;
};

export const completeInstall = async (
	installConfig: AgentInstallConfig,
	apiServerClient?: ApiServerClient,
	defsManager?: DefinitionsManager
): Promise<void> => {
	installConfig.log('\n');
	const awsAgentValues = installConfig.gatewayConfig as SaasAWSAgentValues;
	const resourceFuncsForCleanup: (() => Promise<void>)[] = [];
	const referencedIDPs: { name: string | undefined }[] = [];

	const ctx: CompleteInstallContext = {
		installConfig,
		agentValues: awsAgentValues,
		apiServerClient: apiServerClient as ApiServerClient,
		defsManager: defsManager as DefinitionsManager,
		resourceFuncsForCleanup,
		referencedIDPs,
	};

	if (!await createIDPResources(ctx)) {
		return;
	}
	await setupEnvironment(ctx);

	let dataplaneConfig: DataplaneConfig;
	if (installConfig.gatewayType === GatewayTypes.AWS_GATEWAY && installConfig.switches.isTaEnabled) {
		dataplaneConfig = new AWSDataplaneConfig(
			awsAgentValues.accessLogARN,
			awsAgentValues.fullTransactionLogging,
			awsAgentValues.stageTagName
		);
	} else {
		dataplaneConfig = new DataplaneConfig('AWS');
	}
	ctx.agentValues.dataplaneConfig = dataplaneConfig;

	const dataplaneRes = await createDataplaneResources(ctx, dataplaneConfig);
	if (!dataplaneRes) {
		return;
	}

	await createAgentResources(ctx, dataplaneRes, { redaction: awsAgentValues.redaction });

	installConfig.log(`Install complete of hosted agent for ${installConfig.gatewayType} region`);
};

export const AWSSaaSInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: [],
	AgentNameMap: {
		[AgentTypes.da]: AgentNames.AWS_DA,
		[AgentTypes.ta]: AgentNames.AWS_TA,
	},
	GatewayDisplay: SaaSGatewayTypes.AWS_GATEWAY,
};
