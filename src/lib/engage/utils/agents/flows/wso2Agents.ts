import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BasePaths, BundleType, GatewayTypes, InstallationFlowMethods, PublicDockerRepoBaseUrl, svcAccMsg } from '../../../types.js';
import { askInput, askList, validateRegex } from '../../basic-prompts.js';
import { WSO2AgentValues, wso2DAEnvVarTemplate, wso2TAEnvVarTemplate } from '../templates/wso2Templates.js';
import * as helpers from '../index.js';
import chalk from 'chalk';
import { isWindows, writeTemplates } from '../../utils.js';

const daImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.WSO2_DA}`;
const taImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.WSO2_TA}`;

export const defaultLogFiles = '/group-*_instance-*.log';

// ConfigFiles - all the config file that are used in the setup
export const ConfigFiles = {
	DAEnvVars: `${helpers.configFiles.DA_ENV_VARS}`,
	TAEnvVars: `${helpers.configFiles.TA_ENV_VARS}`,
	WSO2DABinaryFile: 'discovery_agent',
	WSO2DAYaml: 'discovery_agent.yml',
	WSO2TABinaryFile: 'traceability_agent',
	WSO2TAYaml: 'traceability_agent.yml',
};

// WSO2Prompts - prompts for user inputs
const WSO2Prompts = {
	configTypeMsg: 'Select the mode of installation',
	enterWSO2BaseURL: 'Enter the WSO2 baseURL',
	enterWSO2ClientID: 'Enter the WSO2 ClientID',
	enterWSO2ClientSecret: 'Enter the WSO2 ClientSecret',
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
// Questions for the configuration of WSO2 agents
//

const askWSO2BaseURL = async (): Promise<string> =>
	(await askInput({
		msg: WSO2Prompts.enterWSO2BaseURL,
		allowEmptyInput: false,
		validate: validateRegex(
			helpers.WSO2RegexPatterns.wso2BaseURLRegex,
			helpers.invalidValueExampleErrMsg('WSO2_BASEURL', 'https://www.wso2domain.com')
		),
	})) as string;

const askWSO2ClientID = async (): Promise<string> =>
	(await askInput({
		msg: WSO2Prompts.enterWSO2ClientID,
	})) as string;

const askWSO2ClientSecret = async (): Promise<string> =>
	(await askInput({
		msg: WSO2Prompts.enterWSO2ClientSecret,
	})) as string;

export const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<WSO2AgentValues> => {
	const agentValues: WSO2AgentValues = new WSO2AgentValues();
	installConfig.log('\nCONNECTION TO WSO2:');
	installConfig.log(
		chalk.gray(
			'The discovery agent needs to connect to the WSO2 API Manager to discover API\'s for publishing to Amplify.\nThe traceability agent will serve as the trace logging service that will receive WSO2 tracing payloads. These will be forwarded to the Business Insights. There are no specific WSO2 Traceability agent variables.\n'
		)
	);

	if (installConfig.switches.isDaEnabled) {
		installConfig.log(chalk.gray('\nDiscovery Agent Configuration\n'));

		await askDiscoveryPrompts(agentValues);
	}

	return agentValues;
};

const generateSuccessHelpMsg = (installConfig: AgentInstallConfig) => {
	if (installConfig.centralConfig.ampcDosaInfo.isNew && !installConfig.switches.isHelmInstall) {
		installConfig.log(chalk.yellow(svcAccMsg));
	}

	dockerSuccessMsg(installConfig);

	installConfig.log(
		chalk.gray(`\nAdditional information about agent features can be found here:\n${helpers.agentsDocsUrl.WSO2}`)
	);
};

const dockerSuccessMsg = (installConfig: AgentInstallConfig) => {
	let dockerInfo;
	const runDaLinuxMsg = `docker run --env-file ${helpers.pwd}/${helpers.configFiles.DA_ENV_VARS} -v ${helpers.pwd}:/keys ${helpers.eolChar}`;
	const runDaWinMsg = `docker run --env-file ${helpers.pwdWin}/${helpers.configFiles.DA_ENV_VARS} -v ${helpers.pwdWin}:/keys ${helpers.eolCharWin}`;
	const runTaLinuxMsg = `docker run --env-file ${helpers.pwd}/${helpers.configFiles.TA_ENV_VARS} -v ${helpers.pwd}:/keys ${helpers.eolChar}`;
	const runTaWinMsg = `docker run --env-file ${helpers.pwdWin}/${helpers.configFiles.TA_ENV_VARS} -v ${helpers.pwdWin}:/keys ${helpers.eolCharWin}`;
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
		installConfig.log('\t' + chalk.cyan(`-v /data -p 8888:8888 ${helpers.eolChar}`));
		installConfig.log('\t' + chalk.cyan(`${taImageVersion}`) + '\n');
		installConfig.log(chalk.white('Configure WSO2 to connect to localhost:8888.'));
	}
};

async function askDiscoveryPrompts(agentValues: WSO2AgentValues) {
	agentValues.wso2BaseURL = await askWSO2BaseURL();
	agentValues.wso2ClientID = await askWSO2ClientID();
	agentValues.wso2ClientSecret = await askWSO2ClientSecret();
}

export const completeInstall = async (installConfig: AgentInstallConfig): Promise<void> => {
	/**
	 * Create agent resources
	 */
	const agentValues = installConfig.gatewayConfig as WSO2AgentValues;

	// Add final settings to WSO2 agentValues
	agentValues.centralConfig = installConfig.centralConfig;
	agentValues.traceabilityConfig = installConfig.traceabilityConfig;

	installConfig.log('Generating the configuration file(s)...');

	if (installConfig.switches.isDaEnabled) {
		writeTemplates(ConfigFiles.DAEnvVars, agentValues, wso2DAEnvVarTemplate);
	}

	if (installConfig.switches.isTaEnabled) {
		writeTemplates(ConfigFiles.TAEnvVars, agentValues, wso2TAEnvVarTemplate);
	}

	installConfig.log('Configuration file(s) have been successfully created.\n');

	generateSuccessHelpMsg(installConfig);
};

export const WSO2InstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	AgentNameMap: {
		[AgentTypes.da]: AgentNames.WSO2_DA,
		[AgentTypes.ta]: AgentNames.WSO2_TA,
	},
	GatewayDisplay: GatewayTypes.WSO2,
};
