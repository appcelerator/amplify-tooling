import chalk from 'chalk';
import { InstallationFlowMethods, svcAccMsg } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BasePaths, BundleType, GatewayTypes, PublicDockerRepoBaseUrl, YesNo, YesNoChoices } from '../../../types.js';
import { askInput, askList, validateRegex } from '../../basic-prompts.js';
import { isWindows, writeTemplates } from '../../utils.js';
import { KafkaAgentValues } from '../index.js';
import * as helpers from '../index.js';

const daImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.KAFKA_DA}`;
const taImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.KAFKA_TA}`;

// ConfigFiles - all the config file that are used in the setup
export const ConfigFiles = {
	DAEnvVars: `${helpers.configFiles.DA_ENV_VARS}`,
	TAEnvVars: `${helpers.configFiles.TA_ENV_VARS}`,
};

// DeploymentTypes - types of Kafka cluster deployments
export enum DeploymentTypes {
	CONFLUENT_CLOUD = 'Confluent Cloud',
	CONFLUENT_PLATFORM = 'Confluent Platform',
}

// SaslMechanismTypes - SASL authentication mechanism types
export enum SaslMechanismTypes {
	SCRAM_SHA_256 = 'SCRAM-SHA-256',
	SCRAM_SHA_512 = 'SCRAM-SHA-512',
	PLAIN = 'PLAIN',
	OAUTHBEARER = 'OAUTHBEARER',
	NONE = 'NONE',
}

// KafkaPrompts - prompts for user inputs
const prompts = {
	deploymentTypeMsg: 'Select the type of deployment you wish to configure',
	enterEnvironmentId: 'Enter the Environment Id',
	enterClusterId: 'Enter the Cluster Id',
	enterCloudAPIKey: 'Enter the Cloud API Key Id',
	enterCloudAPISecret: 'Enter the Cloud API Key Secret',

	enterClusterServer: 'Enter the Bootstrap Server Name',
	enterClusterAPIKey: 'Enter the Cluster API Key Id',
	enterClusterAPISecret: 'Enter the Cluster API Key Secret',
	saslMechanismMsg: 'Select the SASL Mechanism you wish to use for authentication',
	enterSaslUsername: 'Enter the SASL Username',
	enterSaslPassword: 'Enter the SASL Password',
	enterSaslOAuthTokenUrl: 'Enter the SASL/OAUTHBEARER Token Url',
	enterSaslOAuthClientId: 'Enter the SASL/OAUTHBEARER Client Id',
	enterSaslOAuthClientSecret: 'Enter the SASL/OAUTHBEARER Client Secret',
	enterSaslOAuthClientScopes: 'Enter the SASL/OAUTHBEARER Client Scopes(comma separated list)',

	schemaRegistryEnabledMsg: 'Do you want to use Schema Registry with Kafka cluster?',
	enterSchemaRegistryUrl: 'Enter the Schema Registry Url',
	schemaRegistryAuthEnabled: 'Do you want to authenticate Schema Registry with SASL mechanism?',
	enterSchemaRegistryAPIKey: 'Enter the Schema Registry API Key Id',
	enterSchemaRegistryAPISecret: 'Enter the Schema Registry API Key Secret',
};

export const askBundleType = async (): Promise<BundleType> => {
	return (await askList({
		msg: helpers.agentMessages.selectAgentType,
		choices: [ BundleType.ALL_AGENTS, BundleType.DISCOVERY, BundleType.TRACEABILITY ],
	})) as BundleType;
};

export const askConfigType = async (): Promise<AgentConfigTypes> => {
	return AgentConfigTypes.DOCKERIZED;
};

//
// Questions for the configuration of Kafka agents
//
export const askIsCloudEnabled = async (): Promise<boolean> => {
	const deploymentType = await askList({
		msg: prompts.deploymentTypeMsg,
		default: DeploymentTypes.CONFLUENT_CLOUD,
		choices: [
			{ name: DeploymentTypes.CONFLUENT_CLOUD, value: DeploymentTypes.CONFLUENT_CLOUD },
			{ name: DeploymentTypes.CONFLUENT_PLATFORM, value: DeploymentTypes.CONFLUENT_PLATFORM },
		],
	});
	return deploymentType === DeploymentTypes.CONFLUENT_CLOUD;
};

const askEnvironmentId = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterEnvironmentId,
	})) as string;

const askClusterId = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterClusterId,
	})) as string;

const askCloudAPIKey = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterCloudAPIKey,
	})) as string;

const askCloudAPISecret = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterCloudAPISecret,
	})) as string;

const askClusterServer = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterClusterServer,
		validate: validateRegex(
			helpers.KafkaRegexPatterns.bootstrapServerRegex,
			helpers.invalidValueExampleErrMsg('Bootstrap Server Name', 'SASL_SSL://somehost.testdomain.com:9092')
		),
	})) as string;

const askClusterAPIKey = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterClusterAPIKey,
	})) as string;

const askClusterAPISecret = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterClusterAPISecret,
	})) as string;

export const askSaslMechanism = async (): Promise<string> => {
	return await askList({
		msg: prompts.saslMechanismMsg,
		default: SaslMechanismTypes.PLAIN,
		choices: [
			{ name: SaslMechanismTypes.NONE, value: SaslMechanismTypes.NONE },
			{ name: SaslMechanismTypes.PLAIN, value: SaslMechanismTypes.PLAIN },
			{ name: SaslMechanismTypes.SCRAM_SHA_256, value: SaslMechanismTypes.SCRAM_SHA_256 },
			{ name: SaslMechanismTypes.SCRAM_SHA_512, value: SaslMechanismTypes.SCRAM_SHA_512 },
			{ name: SaslMechanismTypes.OAUTHBEARER, value: SaslMechanismTypes.OAUTHBEARER },
		],
	});
};

const askSaslOAuthBearerTokenUrl = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterSaslOAuthTokenUrl,
		allowEmptyInput: false,
		validate: validateRegex(
			helpers.KafkaRegexPatterns.urlRegex,
			helpers.invalidValueExampleErrMsg('Token URL', 'https://www.testdomain.com/oauth/token')
		),
	})) as string;

const askSaslOAuthBearerClientId = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterSaslOAuthClientId,
		allowEmptyInput: false,
	})) as string;

const askSaslOAuthBearerClientSecret = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterSaslOAuthClientSecret,
		allowEmptyInput: false,
	})) as string;

const askSaslOAuthBearerScopes = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterSaslOAuthClientScopes,
		allowEmptyInput: true,
	})) as string;

const askSaslUsername = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterSaslUsername,
	})) as string;

const askSaslPassword = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterSaslPassword,
	})) as string;

const askIsSchemaRegistryEnabled = async (): Promise<boolean> => {
	const enabled = await askList({
		msg: prompts.schemaRegistryEnabledMsg,
		default: YesNo.Yes,
		choices: YesNoChoices,
	});
	return enabled === YesNo.Yes;
};

export const askIsSchemaRegistryAuthEnabled = async (): Promise<boolean> => {
	const enabled = await askList({
		msg: prompts.schemaRegistryAuthEnabled,
		default: YesNo.Yes,
		choices: YesNoChoices
	});
	return enabled === YesNo.Yes;
};

const askSchemaRegistryUrl = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterSchemaRegistryUrl,
		validate: validateRegex(
			helpers.KafkaRegexPatterns.urlRegex,
			helpers.invalidValueExampleErrMsg('Schema Registry Url', 'https://www.testdomain.com')
		),
	})) as string;

const askSchemaRegistryAPIKey = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterSchemaRegistryAPIKey,
	})) as string;

const askSchemaRegistryAPISecret = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterSchemaRegistryAPISecret,
	})) as string;

export const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<KafkaAgentValues> => {
	const kafkaAgentValues: KafkaAgentValues = new KafkaAgentValues();
	kafkaAgentValues.cloudEnabled = await askIsCloudEnabled();

	if (kafkaAgentValues.cloudEnabled) {
		kafkaAgentValues.cloudEnvironmentId = await askEnvironmentId();
		kafkaAgentValues.cloudClusterId = await askClusterId();
		kafkaAgentValues.cloudAPIKey = await askCloudAPIKey();
		kafkaAgentValues.cloudAPISecret = await askCloudAPISecret();
		kafkaAgentValues.clusterAPIKey = await askClusterAPIKey();
		kafkaAgentValues.clusterAPISecret = await askClusterAPISecret();
	} else {
		kafkaAgentValues.clusterServer = await askClusterServer();
		kafkaAgentValues.clusterSaslMechanism = await askSaslMechanism();
		if (kafkaAgentValues.clusterSaslMechanism !== SaslMechanismTypes.NONE) {
			if (kafkaAgentValues.clusterSaslMechanism === SaslMechanismTypes.OAUTHBEARER) {
				kafkaAgentValues.saslOauthTokenUrl = await askSaslOAuthBearerTokenUrl();
				kafkaAgentValues.saslOauthClientId = await askSaslOAuthBearerClientId();
				kafkaAgentValues.saslOauthClientSecret = await askSaslOAuthBearerClientSecret();
				kafkaAgentValues.saslOauthClientScopes = await askSaslOAuthBearerScopes();
			} else {
				kafkaAgentValues.clusterSaslUser = await askSaslUsername();
				kafkaAgentValues.clusterSaslPassword = await askSaslPassword();
			}
		}
	}

	if (installConfig.switches.isDaEnabled) {
		if (kafkaAgentValues.cloudEnabled) {
			kafkaAgentValues.schemaRegistryAPIKey = await askSchemaRegistryAPIKey();
			kafkaAgentValues.schemaRegistryAPISecret = await askSchemaRegistryAPISecret();
		} else {
			kafkaAgentValues.schemaRegistryEnabled = await askIsSchemaRegistryEnabled();
			if (kafkaAgentValues.schemaRegistryEnabled) {
				kafkaAgentValues.schemaRegistryUrl = await askSchemaRegistryUrl();
				kafkaAgentValues.schemaRegistryAuthEnabled = await askIsSchemaRegistryAuthEnabled();
			}
		}
	}
	return kafkaAgentValues;
};

const generateSuccessHelpMsg = (installConfig: AgentInstallConfig) => {
	if (installConfig.centralConfig.ampcDosaInfo.isNew && !installConfig.switches.isHelmInstall) {
		installConfig.log(chalk.yellow(svcAccMsg));
	}

	dockerSuccessMsg(installConfig);

	installConfig.log(
		chalk.gray(`\nAdditional information about agent features can be found here:\n${helpers.agentsDocsUrl.AZURE}`)
	);
};

const dockerSuccessMsg = (installConfig: AgentInstallConfig) => {
	let dockerInfo;
	const runDaLinuxMsg = `docker run -it --env-file ${helpers.pwd}/${helpers.configFiles.DA_ENV_VARS} -v ${helpers.pwd}:/keys ${helpers.eolChar}`;
	const runDaWinMsg = `docker run -it --env-file ${helpers.pwdWin}/${helpers.configFiles.DA_ENV_VARS} -v ${helpers.pwdWin}:/keys ${helpers.eolCharWin}`;
	const runTaLinuxMsg = `docker run -it --env-file ${helpers.pwd}/${helpers.configFiles.TA_ENV_VARS} -v ${helpers.pwd}:/keys ${helpers.eolChar}`;
	const runTaWinMsg = `docker run -it --env-file ${helpers.pwdWin}/${helpers.configFiles.TA_ENV_VARS} -v ${helpers.pwdWin}:/keys ${helpers.eolCharWin}`;
	const startDaLinuxMsg = '\nStart the Discovery Agent on a Linux based machine';
	const startDaWinMsg = '\nStart the Discovery Agent on a Windows machine';
	const startTaLinuxMsg = '\nStart the Traceability Agent on a Linux based machine';
	const startTaWinMsg = '\nStart the Traceability Agent on a Windows machine';

	if (installConfig.switches.isDaEnabled && installConfig.switches.isTaEnabled) {
		dockerInfo = `To utilize the agents, pull the latest Docker images and run them using the appropriate supplied environment files, (${helpers.configFiles.DA_ENV_VARS} & ${helpers.configFiles.TA_ENV_VARS}):`;
	} else if (installConfig.switches.isDaEnabled) {
		dockerInfo = `To utilize the discovery agent, pull the latest Docker image and run it using the supplied environment file, (${helpers.configFiles.DA_ENV_VARS}):`;
	} else {
		dockerInfo = `To utilize the traceability agent, pull the latest Docker image and run it using the supplied environment file, (${helpers.configFiles.TA_ENV_VARS}):`;
	}
	installConfig.log(chalk.whiteBright(dockerInfo) + '\n');

	if (installConfig.switches.isDaEnabled) {
		const daImageVersion = `${daImage}:${installConfig.daVersion}`;
		installConfig.log(chalk.white('Pull the latest image of the Discovery Agent:'));
		installConfig.log(chalk.cyan(`docker pull ${daImageVersion}`));
		installConfig.log(chalk.white(isWindows ? startDaWinMsg : startDaLinuxMsg));
		installConfig.log(chalk.cyan(isWindows ? runDaWinMsg : runDaLinuxMsg));
		installConfig.log('\t' + chalk.cyan(`-v /data ${daImageVersion}`) + '\n');
	}
	if (installConfig.switches.isTaEnabled) {
		const taImageVersion = `${taImage}:${installConfig.taVersion}`;
		installConfig.log(chalk.white('Pull the latest image of the Traceability Agent:'));
		installConfig.log(chalk.cyan(`docker pull ${taImageVersion}`));
		installConfig.log(chalk.white(isWindows ? startTaWinMsg : startTaLinuxMsg));
		installConfig.log(chalk.cyan(isWindows ? runTaWinMsg : runTaLinuxMsg));
		installConfig.log('\t' + chalk.cyan(`-v /data ${taImageVersion}`) + '\n');
	}
};

export const completeInstall = async (installConfig: AgentInstallConfig): Promise<void> => {
	// Add final settings to kafkaAgentsValues
	const kafkaAgentValues = installConfig.gatewayConfig as KafkaAgentValues;
	kafkaAgentValues.centralConfig = installConfig.centralConfig;
	kafkaAgentValues.traceabilityConfig = installConfig.traceabilityConfig;

	installConfig.log('Generating the configuration file(s)...');

	if (installConfig.switches.isDaEnabled) {
		writeTemplates(ConfigFiles.DAEnvVars, kafkaAgentValues, helpers.kafkaDAEnvVarTemplate);
	}

	if (installConfig.switches.isTaEnabled) {
		writeTemplates(ConfigFiles.TAEnvVars, kafkaAgentValues, helpers.kafkaTAEnvVarTemplate);
	}

	installConfig.log('Configuration file(s) have been successfully created.\n');

	generateSuccessHelpMsg(installConfig);
};

export const KafkaInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	AgentNameMap: {
		[AgentTypes.da]: AgentNames.KAFKA_DA,
		[AgentTypes.ta]: AgentNames.KAFKA_TA,
	},
	GatewayDisplay: GatewayTypes.KAFKA,
};
