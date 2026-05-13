import chalk from 'chalk';
import { InstallationFlowMethods, svcAccMsg } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BasePaths, BundleType, GatewayTypes, PublicDockerRepoBaseUrl } from '../../../types.js';
import { askInput, askList } from '../../basic-prompts.js';
import { isWindows, writeTemplates } from '../../utils.js';
import { IBMAPIConnectAgentValues } from '../index.js';
import * as helpers from '../index.js';

const daImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.IBMAPICONNECT_DA}`;
const taImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.IBMAPICONNECT_TA}`;

export const defaultLogFiles = '/group-*_instance-*.log';

// ConfigFiles - all the config file that are used in the setup
export const ConfigFiles = {
	DAEnvVars: `${helpers.configFiles.DA_ENV_VARS}`,
	TAEnvVars: `${helpers.configFiles.TA_ENV_VARS}`,
	IBMAPIConnectDABinaryFile: 'discovery_agent',
	IBMAPIConnectDAYaml: 'discovery_agent.yml',
	IBMAPIConnectTABinaryFile: 'traceability_agent',
	IBMAPIConnectTAYaml: 'traceability_agent.yml',
};

// IBMAPIConnectPrompts - prompts for user inputs
const IBMAPIConnectPrompts = {
	configTypeMsg: 'Select the mode of installation',
	enterApiConnectURL: 'Enter the IBM API Connect URL',
	enterApiConnectOrgName: 'Enter the IBM API Connect Organization Name',
	enterApiConnectCatalogName: 'Enter the IBM API Connect Catalog Name',
	enterApiConnectAuthAPIKey: 'Enter the IBM API Connect Auth API Key',
	enterApiConnectAuthClientID: 'Enter the IBM API Connect Client ID',
	enterApiConnectAuthClientSecret: 'Enter the IBM API Connect Client Secret',
	enterApiConnectConsumerOrgOwnerUser: 'Enter the IBM API Connect Consumer Organization Owner User',
	enterApiConnectConsumerOrgOwnerRegistry: 'Enter the IBM API Connect Consumer Organization Owner User Registry',
	enterApiConnectAnalyticsServerName: 'Enter the IBM API Connect Analytics Server Name',
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
// Questions for the configuration of IBM API Connect agents
//
const askIBMAPIConnectURL = async (): Promise<string> =>
	(await askInput({
		msg: IBMAPIConnectPrompts.enterApiConnectURL,
	})) as string;

const askIBMAPIConnectOrgName = async (): Promise<string> =>
	(await askInput({
		msg: IBMAPIConnectPrompts.enterApiConnectOrgName,
	})) as string;

const askIBMAPIConnectCatalogName = async (): Promise<string> =>
	(await askInput({
		msg: IBMAPIConnectPrompts.enterApiConnectCatalogName,
	})) as string;

const askIBMAPIConnectAuthAPIKey = async (): Promise<string> =>
	(await askInput({
		msg: IBMAPIConnectPrompts.enterApiConnectAuthAPIKey,
	})) as string;

const askIBMAPIConnectClientID = async (): Promise<string> =>
	(await askInput({
		msg: IBMAPIConnectPrompts.enterApiConnectAuthClientID,
	})) as string;

const askIBMAPIConnectClientSecret = async (): Promise<string> =>
	(await askInput({
		msg: IBMAPIConnectPrompts.enterApiConnectAuthClientSecret,
	})) as string;

const askIBMAPIConnectOrgOwnerUser = async (): Promise<string> =>
	(await askInput({
		msg: IBMAPIConnectPrompts.enterApiConnectConsumerOrgOwnerUser,
	})) as string;

const askIBMAPIConnectOrgOwnerRegistry = async (): Promise<string> =>
	(await askInput({
		msg: IBMAPIConnectPrompts.enterApiConnectConsumerOrgOwnerRegistry,
	})) as string;

const askIBMAPIConnectAnalyticsServerName = async (): Promise<string> =>
	(await askInput({
		msg: IBMAPIConnectPrompts.enterApiConnectAnalyticsServerName,
	})) as string;

export const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<IBMAPIConnectAgentValues> => {
	const ibmAPIConnectAgentValues: IBMAPIConnectAgentValues = new IBMAPIConnectAgentValues();
	console.log('\nCONNECTION TO IBM API Connect:');
	console.log(
		chalk.gray(
			'The discovery agent needs to connect to the IBM API Connect Gateway to discover API\'s for publishing to Amplify.\nThe traceability agent needs to connect to IBM API Connect for collecting APIs transactions. These will be forwarded to the Business Insights.\n'
		)
	);

	await askCommonPrompts(ibmAPIConnectAgentValues);

	// IBM API Connect Discovery Agent Prompts
	if (installConfig.switches.isDaEnabled) {
		console.log(chalk.gray('\nDiscovery Agent Configuration\n'));

		await askDiscoveryPrompts(ibmAPIConnectAgentValues);
	}

	// IBM API Connect Traceability Agent Prompts
	if (installConfig.switches.isTaEnabled) {
		console.log(chalk.gray('\nTraceability Agent Configuration\n'));

		await askTraceabilityPrompts(ibmAPIConnectAgentValues);
	}

	return ibmAPIConnectAgentValues;
};

const generateSuccessHelpMsg = (installConfig: AgentInstallConfig) => {
	if (installConfig.centralConfig.ampcDosaInfo.isNew && !installConfig.switches.isHelmInstall) {
		console.log(chalk.yellow(svcAccMsg));
	}

	dockerSuccessMsg(installConfig);

	console.log(
		chalk.gray(
			`\nAdditional information about agent features can be found here:\n${helpers.agentsDocsUrl.IBMAPICONNECT}`
		)
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
	console.log(chalk.whiteBright(dockerInfo), '\n');

	if (installConfig.switches.isDaEnabled) {
		const daImageVersion = `${daImage}:${installConfig.daVersion}`;
		console.log(chalk.white('Pull the latest image of the Discovery Agent:'));
		console.log(chalk.cyan(`docker pull ${daImageVersion}`));
		console.log(chalk.white(isWindows ? startDaWinMsg : startDaLinuxMsg));
		console.log(chalk.cyan(isWindows ? runDaWinMsg : runDaLinuxMsg));
		console.log('\t', chalk.cyan(`-v /data ${daImageVersion}`), '\n');
	}
	if (installConfig.switches.isTaEnabled) {
		const taImageVersion = `${taImage}:${installConfig.taVersion}`;
		console.log(chalk.white('Pull the latest image of the Traceability Agent:'));
		console.log(chalk.cyan(`docker pull ${taImageVersion}`));
		console.log(chalk.white(isWindows ? startTaWinMsg : startTaLinuxMsg));
		console.log(chalk.cyan(isWindows ? runTaWinMsg : runTaLinuxMsg));
		console.log('\t', chalk.cyan(`-v /data ${taImageVersion}`), '\n');
	}
};

async function askCommonPrompts(ibmAPIConnectAgentValues: IBMAPIConnectAgentValues) {
	// IBM API Connect URL
	ibmAPIConnectAgentValues.apiConnectURL = await askIBMAPIConnectURL();
	// IBM API Connect Org Name
	ibmAPIConnectAgentValues.apiConnectOrgName = await askIBMAPIConnectOrgName();
	// IBM API Connect Catalog Name
	ibmAPIConnectAgentValues.apiConnectCatalogName = await askIBMAPIConnectCatalogName();
	// IBM API Connect Auth API Key
	ibmAPIConnectAgentValues.apiConnectAuthAPIKey = await askIBMAPIConnectAuthAPIKey();
	// IBM API Connect Auth Client ID
	ibmAPIConnectAgentValues.apiConnectAuthClientID = await askIBMAPIConnectClientID();
	// IBM API Connect Auth Client Secret
	ibmAPIConnectAgentValues.apiConnectAuthClientSecret = await askIBMAPIConnectClientSecret();
}

// IBM API Connect DA prompts
async function askDiscoveryPrompts(ibmAPIConnectAgentValues: IBMAPIConnectAgentValues) {
	// IBM API Connect Consumer Org Owner User
	ibmAPIConnectAgentValues.apiConnectConsumerOrgOwnerUser = await askIBMAPIConnectOrgOwnerUser();
	// IBM API Connect Consumer Org Owner Registry
	ibmAPIConnectAgentValues.apiConnectConsumerOrgOwnerRegistry = await askIBMAPIConnectOrgOwnerRegistry();
}

async function askTraceabilityPrompts(ibmAPIConnectAgentValues: IBMAPIConnectAgentValues) {
	// IBM API Connect Analytics Server Name
	ibmAPIConnectAgentValues.apiConnectAnalyticsServerName = await askIBMAPIConnectAnalyticsServerName();
}

export const completeInstall = async (installConfig: AgentInstallConfig): Promise<void> => {
	/**
	 * Create agent resources
	 */
	const ibmAPIConnectAgentValues = installConfig.gatewayConfig as IBMAPIConnectAgentValues;

	// Add final settings to ibmAPIConnectAgentValues
	ibmAPIConnectAgentValues.centralConfig = installConfig.centralConfig;
	ibmAPIConnectAgentValues.traceabilityConfig = installConfig.traceabilityConfig;

	console.log('Generating the configuration file(s)...');

	if (installConfig.switches.isDaEnabled) {
		writeTemplates(ConfigFiles.DAEnvVars, ibmAPIConnectAgentValues, helpers.ibmAPIConnectDAEnvVarTemplate);
	}

	if (installConfig.switches.isTaEnabled) {
		writeTemplates(ConfigFiles.TAEnvVars, ibmAPIConnectAgentValues, helpers.ibmAPIConnectTAEnvVarTemplate);
	}

	console.log('Configuration file(s) have been successfully created.\n');

	generateSuccessHelpMsg(installConfig);
};

export const IBMAPIConnectInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	AgentNameMap: {
		[AgentTypes.da]: AgentNames.IBMAPICONNECT_DA,
		[AgentTypes.ta]: AgentNames.IBMAPICONNECT_TA,
	},
	GatewayDisplay: GatewayTypes.IBMAPICONNECT,
};
