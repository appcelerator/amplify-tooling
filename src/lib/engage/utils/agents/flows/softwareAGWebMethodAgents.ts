import chalk from 'chalk';
import { InstallationFlowMethods, svcAccMsg } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BasePaths, BundleType, GatewayTypes, PublicDockerRepoBaseUrl } from '../../../types.js';
import { askInput, askList } from '../../basic-prompts.js';
import { isWindows, writeTemplates } from '../../utils.js';
import { SoftwareAGWebMethodsAgentValues } from '../index.js';
import * as helpers from '../index.js';

const daImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.SOFTWAREAGWEBMETHODS_DA}`;
const taImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.SOFTWAREAGWEBMETHODS_TA}`;

// ConfigFiles - all the config file that are used in the setup
export const ConfigFiles = {
	DAEnvVars: `${helpers.configFiles.DA_ENV_VARS}`,
	TAEnvVars: `${helpers.configFiles.TA_ENV_VARS}`,
};

// WebMethods - prompts for user inputs
const prompts = {
	pathURL: 'Enter the base URL to connect to your Software AG WebMethods API service',
	pathUsername: 'Enter the username to authenticate to Software AG WebMethods',
	pathPassword: 'Enter the password to authenticate to Software AG WebMethods',
	pathOauth2Server: 'Enter the OAuth2 server to authenticate. Defaults to local gateway auth',
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
// Questions for the configuration of Software AG WebMethods agents
//
async function askCommonPrompts(webMethodsAgentValues: SoftwareAGWebMethodsAgentValues) {
	// Software AG WebMethods Path URL
	webMethodsAgentValues.pathURL = await askPathURL();
	// Software AG WebMethods Path Username
	webMethodsAgentValues.pathUsername = await askPathUsername();
	// Software AG WebMethods Path Password
	webMethodsAgentValues.pathPassword = await askPathPassword();
	// Software AG WebMethods Path Oauth2Server
	webMethodsAgentValues.pathOauth2Server = await askPathOauth2Server();
	if (webMethodsAgentValues.pathOauth2Server.trim() === '') {
		webMethodsAgentValues.pathOauth2Server = 'local';
	}
}
const askPathURL = async (): Promise<string> =>
	(await askInput({
		msg: prompts.pathURL,
	})) as string;

const askPathUsername = async (): Promise<string> =>
	(await askInput({
		msg: prompts.pathUsername,
	})) as string;

const askPathPassword = async (): Promise<string> =>
	(await askInput({
		msg: prompts.pathPassword,
	})) as string;

const askPathOauth2Server = async (): Promise<string> =>
	(await askInput({
		msg: prompts.pathOauth2Server,
		allowEmptyInput: true,
		defaultValue: 'local'
	})) as string;

export const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<SoftwareAGWebMethodsAgentValues> => {
	const webMethodsAgentValues: SoftwareAGWebMethodsAgentValues = new SoftwareAGWebMethodsAgentValues();
	installConfig.log('\nCONNECTION TO Software AG WebMethods:');
	installConfig.log(
		chalk.gray(
			'The discovery agent needs to connect to the Software AG WebMethods Gateway to discover API\'s for publishing to Amplify.\nThe traceability agent needs to connect to Software AG WebMethods for collecting APIs transactions. These will be forwarded to the Business Insights.\n'
		)
	);
	if (installConfig.switches.isDaEnabled || installConfig.switches.isTaEnabled) {
		await askCommonPrompts(webMethodsAgentValues);
	}

	return webMethodsAgentValues;
};

const generateSuccessHelpMsg = (installConfig: AgentInstallConfig) => {
	if (installConfig.centralConfig.ampcDosaInfo.isNew && !installConfig.switches.isHelmInstall) {
		installConfig.log(chalk.yellow(svcAccMsg));
	}

	dockerSuccessMsg(installConfig);

	installConfig.log(
		chalk.gray(`\nAdditional information about agent features can be found here:\n${helpers.agentsDocsUrl.SOFTWAREAGWEBMETHODS}`)
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
	// Add final settings to softwareAGWebMethodsAgentValues
	const softwareAGWebMethodsAgentValues = installConfig.gatewayConfig as SoftwareAGWebMethodsAgentValues;
	softwareAGWebMethodsAgentValues.centralConfig = installConfig.centralConfig;
	softwareAGWebMethodsAgentValues.traceabilityConfig = installConfig.traceabilityConfig;

	installConfig.log('Generating the configuration file(s)...');

	if (installConfig.switches.isDaEnabled) {
		writeTemplates(ConfigFiles.DAEnvVars, softwareAGWebMethodsAgentValues, helpers.softwareAGWebMethodsDAEnvVarTemplate);
	}

	if (installConfig.switches.isTaEnabled) {
		writeTemplates(ConfigFiles.TAEnvVars, softwareAGWebMethodsAgentValues, helpers.softwareAGWebMethodsTAEnvVarTemplate);
	}

	installConfig.log('Configuration file(s) have been successfully created.\n');

	generateSuccessHelpMsg(installConfig);
};

export const SoftwareAGWebMethodsInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	AgentNameMap: {
		[AgentTypes.da]: AgentNames.SOFTWAREAGWEBMETHODS_DA,
		[AgentTypes.ta]: AgentNames.SOFTWAREAGWEBMETHODS_TA,
	},
	GatewayDisplay: GatewayTypes.SOFTWAREAGWEBMETHODS,
};
