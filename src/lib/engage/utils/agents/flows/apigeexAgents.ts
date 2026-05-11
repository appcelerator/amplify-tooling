import chalk from 'chalk';
import { InstallationFlowMethods, svcAccMsg } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, ApigeeMetricsFilterConfig, BasePaths, BundleType, GatewayTypes, PublicDockerRepoBaseUrl, YesNo, YesNoChoices } from '../../../types.js';
import { askInput, askList, validateRegex } from '../../basic-prompts.js';
import { isWindows, writeTemplates } from '../../utils.js';
import { ApigeeXAgentValues } from '../index.js';
import * as helpers from '../index.js';

const daImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.APIGEEX_DA}`;
const taImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.APIGEEX_TA}`;

export const defaultLogFiles = '/group-*_instance-*.log';

// ConfigFiles - all the config file that are used in the setup
export const ConfigFiles = {
	DAEnvVars: `${helpers.configFiles.DA_ENV_VARS}`,
	TAEnvVars: `${helpers.configFiles.TA_ENV_VARS}`,
	ApigeeXDABinaryFile: 'discovery_agent',
	ApigeeXDAYaml: 'discovery_agent.yml',
	ApigeeXTABinaryFile: 'traceability_agent',
	ApigeeXTAYaml: 'traceability_agent.yml',
};

// ApigeeXPrompts - prompts for user inputs
const ApigeeXPrompts = {
	AUTHENTICATION_TYPE: 'Authenticate with an Impersonation of a Service Account or by providing a Credential File',
	PROJECT_ID: 'Enter the APIGEE X Project ID the agent will use',
	DEVELOPER_EMAIL_ADDRESS: 'Enter the APIGEE X Developer Email Address the agent will use',
	AUTH_FILE_NAME: 'Enter the GCP key file name (place in the same directory as your Axway public and private keys)',
	UPLOAD_CREDENTIAL_FILE: 'Upload a JSON Credential file to be used for APIGEE X Authentication',
	DA_FREQUENCY: 'How often should the discovery run, leave blank for integrating in CI/CD process',
	TA_FREQUENCY: 'How often should the traffic collection run, leave blank for manual trigger only',
	QUEUE: 'Do you want to discover immediately after installation',
	ENTER_MORE: 'Do you want to enter another {0} for {1}',
	FILTER_METRICS: 'Do you want metrics filtering?',
	FILTERED_APIS: 'Enter APIs to filter metrics for',
	ENTER_MORE_APIS: 'Do you want to add another API?',
	ENVIRONMENT: 'Enter the Apigee Environment to filter discovered APIs/metrics',
};

export const askBundleType = async (gateway?: GatewayTypes): Promise<BundleType> => {
	console.log(gateway);
	if (gateway === GatewayTypes.APIGEEX_GATEWAY) {
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
// Questions for the configuration of Apigee X agents
//
const askApigeeXProjectId = async (): Promise<string> =>
	(await askInput({
		msg: ApigeeXPrompts.PROJECT_ID,
		validate: validateRegex(
			helpers.APIGEEXRegexPatterns.APIGEEX_REGEXP_PROJECT_ID,
			helpers.invalidValueExampleErrMsg('Project ID', 'rd-amplify-apigee-x')
		),
	})) as string;

const askApigeeXDeveloperEmailAddress = async (): Promise<string> =>
	(await askInput({
		msg: ApigeeXPrompts.DEVELOPER_EMAIL_ADDRESS,
	})) as string;

const askApigeeXAuthFileName = async (): Promise<string> =>
	(await askInput({
		msg: ApigeeXPrompts.AUTH_FILE_NAME,
	})) as string;

const askApigeeXEnvironment = async (): Promise<string> =>
	(await askInput({
		msg: ApigeeXPrompts.ENVIRONMENT,
		defaultValue: '',
		allowEmptyInput: true,
	})) as string;

const askApigeeXMetricFilterConfig = async (): Promise<ApigeeMetricsFilterConfig> => {
	const filteredAPIs: string[] = [];
	const filterMetricsEnabled = await askList({
		msg: ApigeeXPrompts.FILTER_METRICS,
		default: YesNo.No,
		choices: YesNoChoices,
	}) as YesNo === YesNo.Yes;
	if (filterMetricsEnabled) {
		let askFilteredAPIs = true;
		console.log(chalk.gray('An array of APIs to filter metrics for'));
		while (askFilteredAPIs) {
			const api = (await askInput({
				msg: ApigeeXPrompts.FILTERED_APIS,
				allowEmptyInput: true,
			})) as string;

			filteredAPIs.push(api);

			askFilteredAPIs = await askList({
				msg: ApigeeXPrompts.ENTER_MORE_APIS,
				default: YesNo.No,
				choices: YesNoChoices,
			}) === YesNo.Yes;
		}
	}

	return new ApigeeMetricsFilterConfig(filterMetricsEnabled, filteredAPIs);
};

export const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<ApigeeXAgentValues> => {
	const apigeeXAgentValues: ApigeeXAgentValues = new ApigeeXAgentValues();

	console.log('\nCONNECTION TO APIGEE X API GATEWAY:');
	console.log(
		chalk.gray(
			'The discovery agent needs to connect to the APIGEE X API Gateway to discover API\'s for publishing to Amplify.\n'
		));

	// Apigee X Discovery Agent Prompts
	if (installConfig.switches.isDaEnabled) {
		console.log(
			chalk.gray(
				'\nDiscovery Agent Configuration\n'
			)
		);

		await askDiscoveryPrompts(apigeeXAgentValues);
	}

	// Apigee X Traceability Agent Prompts
	if (installConfig.switches.isTaEnabled) {
		console.log(
			chalk.gray(
				'\nTraceability Agent Configuration\n'
			)
		);

		await askTraceabilityPrompts(apigeeXAgentValues);
	}

	return apigeeXAgentValues;
};

const generateSuccessHelpMsg = (installConfig: AgentInstallConfig) => {
	if (installConfig.centralConfig.ampcDosaInfo.isNew && !installConfig.switches.isHelmInstall) {
		console.log(
			chalk.yellow(svcAccMsg)
		);
	}

	dockerSuccessMsg(installConfig);

	console.log(
		chalk.gray(`\nAdditional information about agent features can be found here:\n${helpers.agentsDocsUrl.APIGEEX}`)
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

// ApigeeX DA prompts
async function askDiscoveryPrompts(apigeeXAgentValues: ApigeeXAgentValues) {
	// Apigee X ProjectId
	apigeeXAgentValues.projectId = await askApigeeXProjectId();
	// Apigee X Developer Email Address
	apigeeXAgentValues.developerEmailAddress = await askApigeeXDeveloperEmailAddress();
	// Apigee X Auth File Path
	apigeeXAgentValues.fileName = await askApigeeXAuthFileName();
	// Apigee X Environment
	apigeeXAgentValues.environment = await askApigeeXEnvironment();
}

async function askTraceabilityPrompts(apigeeXAgentValues: ApigeeXAgentValues) {
	// Apigee X Filter metrics
	apigeeXAgentValues.metricsFilter = await askApigeeXMetricFilterConfig();
}

export const completeInstall = async (installConfig: AgentInstallConfig): Promise<void> => {
	/**
     * Create agent resources
     */
	const apigeeXAgentValues = installConfig.gatewayConfig as ApigeeXAgentValues;

	// Add final settings to apigeeXAgentValues
	apigeeXAgentValues.centralConfig = installConfig.centralConfig;
	apigeeXAgentValues.traceabilityConfig = installConfig.traceabilityConfig;

	console.log('Generating the configuration file(s)...');

	if (installConfig.switches.isDaEnabled) {
		writeTemplates(ConfigFiles.DAEnvVars, apigeeXAgentValues, helpers.apigeeXDAEnvVarTemplate);
	}

	if (installConfig.switches.isTaEnabled) {
		writeTemplates(ConfigFiles.TAEnvVars, apigeeXAgentValues, helpers.apigeeXTAEnvVarTemplate);
	}

	console.log('Configuration file(s) have been successfully created.\n');

	generateSuccessHelpMsg(installConfig);
};

export const ApigeeXInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	AgentNameMap: {
		[AgentTypes.da]: AgentNames.APIGEEX_DA,
		[AgentTypes.ta]: AgentNames.APIGEEX_TA,
	},
	GatewayDisplay: GatewayTypes.APIGEEX_GATEWAY,
};
