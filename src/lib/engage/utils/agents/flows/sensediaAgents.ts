import chalk from 'chalk';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BasePaths, BundleType, GatewayTypes, InstallationFlowMethods, PublicDockerRepoBaseUrl, svcAccMsg, YesNo, YesNoChoices } from '../../../types.js';
import { askInput, askList, validateRegex } from '../../basic-prompts.js';
import { isWindows, writeTemplates } from '../../utils.js';
import { SensediaAgentValues } from '../index.js';
import * as helpers from '../index.js';

const daImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.SENSEDIA_DA}`;
const taImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.SENSEDIA_TA}`;

// ConfigFiles - all the config file that are used in the setup
export const ConfigFiles = {
	DAEnvVars: `${helpers.configFiles.DA_ENV_VARS}`,
	TAEnvVars: `${helpers.configFiles.TA_ENV_VARS}`,
	SensediaDABinaryFile: 'discovery_agent',
	SensediaDAYaml: 'discovery_agent.yml',
	SensediaTABinaryFile: 'traceability_agent',
	SensediaTAYaml: 'traceability_agent.yml',
};

// SensediaPrompts - prompts for user inputs
const SensediaPrompts = {
	configTypeMsg: 'Select the mode of installation',
	enterBaseUrl: 'Enter the Sensedia Base URL',
	selectAuthMethod: 'Select the authentication method',
	enterClientId: 'Enter the Sensedia Client ID',
	enterClientSecret: 'Enter the Sensedia Client Secret',
	enterAuthToken: 'Enter the Sensedia Authentication Token',
	enterDeveloperEmail: 'Enter the Developer Email',
	enterEnvironments: 'Do you want to configure specific environments for discovery and reporting? If no value is provided, discovery occurs on all the environments',
	enterMoreEnvironments: 'Enter an environment name (or press Enter to finish)',
	invalidEnvironmentMessage: 'Commas are not allowed in the name due to the way the agent parses the environments list. Make sure you input one environment name at a time'
};

export const askBundleType = async (gateway?: GatewayTypes): Promise<BundleType> => {
	if (gateway === GatewayTypes.SENSEDIA) {
		return (await askList({
			msg: helpers.agentMessages.selectAgentType,
			choices: [ BundleType.ALL_AGENTS, BundleType.DISCOVERY ],
		})) as BundleType;
	} else {
		return BundleType.DISCOVERY;
	}
};

export const askConfigType = async (): Promise<AgentConfigTypes> => {
	return AgentConfigTypes.DOCKERIZED;
};

//
// Questions for the configuration of Sensedia agents
//
const askSensediaBaseUrl = async (): Promise<string> =>
	(await askInput({
		msg: SensediaPrompts.enterBaseUrl,
		validate: validateRegex(
			helpers.SensediaRegexPatterns.urlRegex,
			helpers.invalidValueExampleErrMsg('baseURL', 'https://sensedia.com'),
		),
	})) as string;

const askSensediaAuthMethod = async (): Promise<string> =>
	(await askList({
		msg: SensediaPrompts.selectAuthMethod,
		choices: [
			{ name: helpers.SensediaAuthType.OAuth, value: helpers.SensediaAuthType.OAuth },
			{ name: helpers.SensediaAuthType.StaticToken, value: helpers.SensediaAuthType.StaticToken },
		],
	})) as string;

const askSensediaClientId = async (): Promise<string> =>
	(await askInput({
		msg: SensediaPrompts.enterClientId,
	})) as string;

const askSensediaClientSecret = async (): Promise<string> =>
	(await askInput({
		msg: SensediaPrompts.enterClientSecret,
	})) as string;

const askSensediaAuthToken = async (): Promise<string> =>
	(await askInput({
		msg: SensediaPrompts.enterAuthToken,
	})) as string;

const askSensediaDeveloperEmail = async (): Promise<string> =>
	(await askInput({
		msg: SensediaPrompts.enterDeveloperEmail,
		validate: validateRegex(
			helpers.SensediaRegexPatterns.emailRegex,
			helpers.invalidValueExampleErrMsg('DeveloperEmail', 'dev@gmail.com'),
		),
	})) as string;

const askSensediaEnvironments = async (): Promise<string[]> => {
	const environments: string[] = [];
	const addEnvironments: boolean = (await askList({
		msg: SensediaPrompts.enterEnvironments,
		default: YesNo.No,
		choices: YesNoChoices,
	})) === YesNo.Yes;
	// eslint-disable-next-line no-unmodified-loop-condition
	while (addEnvironments) {
		const env = (await askInput({
			msg: SensediaPrompts.enterMoreEnvironments,
			validate: validateRegex(
				helpers.SensediaRegexPatterns.noCommaRegex,
				SensediaPrompts.invalidEnvironmentMessage,
			),
			allowEmptyInput: true,
		})) as string;
		if (env && env.trim() !== '') {
			environments.push(env);
		} else {
			return environments;
		}
	}
	return environments;
};

export const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<SensediaAgentValues> => {
	const SensediaAgentValues: SensediaAgentValues = new helpers.SensediaAgentValues();

	installConfig.log('\nCONNECTION TO Sensedia:');
	installConfig.log(
		chalk.gray(
			'The discovery agent needs to connect to the Sensedia to discover API\'s for publishing to Amplify.\nThe traceability agent needs to connect to an Sensedia for collecting APIs transactions. These will be forwarded to the Business Insights.\n'
		)
	);

	// Sensedia Discovery Agent Prompts
	if (installConfig.switches.isDaEnabled) {
		installConfig.log(chalk.gray('\nDiscovery Agent Configuration\nThe discovery agent needs to connect to Sensedia.'));
		await askDiscoveryPrompts(SensediaAgentValues);
	}

	return SensediaAgentValues;
};

const generateSuccessHelpMsg = (installConfig: AgentInstallConfig) => {
	if (installConfig.centralConfig.ampcDosaInfo.isNew && !installConfig.switches.isHelmInstall) {
		installConfig.log(chalk.yellow(svcAccMsg));
	}

	dockerSuccessMsg(installConfig);

	installConfig.log(
		chalk.gray(`\nAdditional information about agent features can be found here:\n${helpers.agentsDocsUrl.SENSEDIA}`)
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

// Sensedia DA prompts
async function askDiscoveryPrompts(sensediaAgentValues: SensediaAgentValues) {
	// Sensedia Base URL
	sensediaAgentValues.baseUrl = await askSensediaBaseUrl();

	// Sensedia Authentication Method
	sensediaAgentValues.authType = await askSensediaAuthMethod();

	if (sensediaAgentValues.authType === helpers.SensediaAuthType.OAuth) {
		// OAuth authentication
		sensediaAgentValues.clientId = await askSensediaClientId();
		sensediaAgentValues.clientSecret = await askSensediaClientSecret();
	} else {
		// Static token authentication
		sensediaAgentValues.authToken = await askSensediaAuthToken();
	}

	// Sensedia Developer Email
	sensediaAgentValues.developerEmail = await askSensediaDeveloperEmail();

	// Sensedia Environments
	sensediaAgentValues.environments = [ ...new Set(await askSensediaEnvironments()) ];
}

export const completeInstall = async (installConfig: AgentInstallConfig): Promise<void> => {
	/**
	 * Create agent resources
	 */
	const sensediaAgentValues = installConfig.gatewayConfig as SensediaAgentValues;

	// Add final settings to SensediaAgentsValues
	sensediaAgentValues.centralConfig = installConfig.centralConfig;
	sensediaAgentValues.traceabilityConfig = installConfig.traceabilityConfig;

	installConfig.log('Generating the configuration file(s)...');

	if (installConfig.switches.isDaEnabled) {
		writeTemplates(ConfigFiles.DAEnvVars, sensediaAgentValues, helpers.sensediaDAEnvVarTemplate);
	}

	if (installConfig.switches.isTaEnabled) {
		writeTemplates(ConfigFiles.TAEnvVars, sensediaAgentValues, helpers.sensediaTAEnvVarTemplate);
	}

	installConfig.log('Configuration file(s) have been successfully created.\n');

	generateSuccessHelpMsg(installConfig);
};

export const SensediaInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	AgentNameMap: {
		[AgentTypes.da]: AgentNames.SENSEDIA_DA,
		[AgentTypes.ta]: AgentNames.SENSEDIA_TA,
	},
	GatewayDisplay: GatewayTypes.SENSEDIA,
};
