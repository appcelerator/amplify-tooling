import chalk from 'chalk';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BasePaths, BundleType, GatewayTypes, InstallationFlowMethods, PublicDockerRepoBaseUrl, svcAccMsg } from '../../../types.js';
import { askInput, askList, validateRegex } from '../../basic-prompts.js';
import { dockerLoginInfo, isWindows, writeTemplates } from '../../utils.js';
import { AzureAgentValues } from '../index.js';
import * as helpers from '../index.js';

const daImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.AZURE_DA}`;
const taImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.AZURE_TA}`;

const InvalidMessages = {
	enterApiManagementServiceName: 'The API Management Service Name can contain only letters, numbers and hyphens. The first character must be a letter and last character must be a letter or a number.',
};

export const defaultLogFiles = '/group-*_instance-*.log';

// ConfigFiles - all the config file that are used in the setup
export const ConfigFiles = {
	DAEnvVars: helpers.configFiles.DA_ENV_VARS,
	TAEnvVars: helpers.configFiles.TA_ENV_VARS,
	AzureDABinaryFile: 'discovery_agent',
	AzureDAYaml: 'discovery_agent.yml',
	AzureTABinaryFile: 'traceability_agent',
	AzureTAYaml: 'traceability_agent.yml',
};

// AzurePrompts - prompts for user inputs
const AzurePrompts = {
	configTypeMsg: 'Select the mode of installation',
	enterEventHubName: 'Enter the Azure Event Hub Name',
	enterEventHubNamespace: 'Enter the Azure Event Hub Namespace',
	enterPolicyKey: 'Enter the Azure Policy Key',
	enterPolicyName: 'Enter the Azure Policy Name',
	enterTenantId: 'Enter the Azure Tenant ID',
	enterSubscriptionId: 'Enter the Azure Subscription ID',
	enterServicePrincipalClientId: 'Enter the Azure Service Principal Client ID',
	enterServicePrincipalClientSecret: 'Enter the Azure Service Principal Client Secret',
	enterResourceGroupName: 'Enter the Azure Resource Group Name',
	enterApiManagementServiceName: 'Enter the Azure API Management Service Name',
};

export const askBundleType = async (gateway?: GatewayTypes): Promise<BundleType> => {
	if (gateway === GatewayTypes.AZURE_GATEWAY) {
		return (await askList({
			msg: helpers.agentMessages.selectAgentType,
			choices: [ BundleType.ALL_AGENTS, BundleType.DISCOVERY, BundleType.TRACEABILITY ],
		})) as BundleType;
	} else {
		return BundleType.DISCOVERY;
	}
};

export const askConfigType = async (): Promise<AgentConfigTypes> => {
	return AgentConfigTypes.DOCKERIZED;
};
//
// Questions for the configuration of Azure agents
//
const askAzureTenantId = async (): Promise<string> =>
	(await askInput({
		msg: AzurePrompts.enterTenantId,
	})) as string;

const askAzureSubscriptionId = async (): Promise<string> =>
	(await askInput({
		msg: AzurePrompts.enterSubscriptionId,
	})) as string;

const askAzureServicePrincipalClientId = async (): Promise<string> =>
	(await askInput({
		msg: AzurePrompts.enterServicePrincipalClientId,
	})) as string;

const askAzureServicePrincipalClientSecret = async (): Promise<string> =>
	(await askInput({
		msg: AzurePrompts.enterServicePrincipalClientSecret,
	})) as string;

const askAzureResourceGroupName = async (): Promise<string> =>
	(await askInput({
		msg: AzurePrompts.enterResourceGroupName,
	})) as string;

const askAzureApiManagementServiceName = async (): Promise<string> =>
	(await askInput({
		msg: AzurePrompts.enterApiManagementServiceName,
		validate: validateRegex(
			helpers.AzureRegexPatterns.azureApiManagementServiceNameRegex,
			InvalidMessages.enterApiManagementServiceName
		),
	})) as string;

const askAzureEventHubNamespace = async (): Promise<string> =>
	(await askInput({
		msg: AzurePrompts.enterEventHubNamespace,
	})) as string;

const askAzureEventHubName = async (): Promise<string> =>
	(await askInput({
		msg: AzurePrompts.enterEventHubName,
	})) as string;

const askAzurePolicyName = async (): Promise<string> =>
	(await askInput({
		msg: AzurePrompts.enterPolicyName,
		defaultValue: 'RootManageSharedAccessKey',
	})) as string;

const askAzurePolicyKey = async (): Promise<string> =>
	(await askInput({
		msg: AzurePrompts.enterPolicyKey,
	})) as string;

export const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<AzureAgentValues> => {
	const azureAgentValues: AzureAgentValues = new AzureAgentValues();

	if (installConfig.gatewayType === GatewayTypes.AZURE_EVENTHUB) {
		azureAgentValues.isAzureEventHub = true;

		installConfig.log('\nCONNECTION TO AZURE EVENTHUB:');
		installConfig.log(
			chalk.gray(
				'The discovery agent needs to connect to the Azure EventHub to discover API\'s for publishing to Amplify.\n'
			)
		);
	} else {
		installConfig.log('\nCONNECTION TO AZURE:');
		installConfig.log(
			chalk.gray(
				'The discovery agent needs to connect to the Azure API Gateway to discover API\'s for publishing to Amplify.\nThe traceability agent needs to connect to an Azure Event Hub for collecting APIs transactions. These will be forwarded to the Business Insights.\n'
			)
		);
	}

	// Azure Discovery Agent Prompts
	if (installConfig.switches.isDaEnabled) {
		installConfig.log(
			chalk.gray(
				'\nDiscovery Agent Configuration\nThe discovery agent needs to connect to Azure using a service principal with password based authentication. Refer to https://docs.microsoft.com/en-us/cli/azure/create-an-azure-service-principal-azure-cli for creating such service principal using Azure CLI.'
			)
		);

		await askDiscoveryPrompts(azureAgentValues, installConfig.gatewayType as GatewayTypes);
	}

	// Azure Traceability Agent Prompts
	if (installConfig.switches.isTaEnabled) {
		installConfig.log(
			chalk.gray(
				'\nTraceability Agent Configuration\nThe traceability agent needs to connect to Azure Event Hub using a Policy. Refer to https://docs.microsoft.com/en-us/azure/event-hubs/authorize-access-shared-access-signature.'
			)
		);

		await askTraceabilityPrompts(azureAgentValues);
		// ask discovery prompts without asking for an agent name, or displaying the Discovery Configuration message
		if (installConfig.switches.isTaEnabled && !installConfig.switches.isDaEnabled) {
			await askDiscoveryPrompts(azureAgentValues, installConfig.gatewayType as GatewayTypes);
		}
	}

	return azureAgentValues;
};

const generateSuccessHelpMsg = (installConfig: AgentInstallConfig) => {
	if (installConfig.centralConfig.ampcDosaInfo.isNew && !installConfig.switches.isHelmInstall) {
		installConfig.log(
			chalk.yellow(
				svcAccMsg
			)
		);
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
	dockerLoginInfo();
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

// Azure DA prompts
async function askDiscoveryPrompts(azureAgentValues: AzureAgentValues, gatewayType: GatewayTypes) {
	// Azure Tenant Id
	azureAgentValues.tenantId = await askAzureTenantId();
	// Azure Subscription Id
	azureAgentValues.subscriptionId = await askAzureSubscriptionId();
	// Azure Service Principal Client Id
	azureAgentValues.servicePrincipalClientId = await askAzureServicePrincipalClientId();
	// Azure Service Principal Client Secret
	azureAgentValues.servicePrincipalClientSecret = await askAzureServicePrincipalClientSecret();
	// Azure Resource Group Name
	azureAgentValues.resourceGroupName = await askAzureResourceGroupName();

	if (gatewayType === GatewayTypes.AZURE_GATEWAY) {
		// Azure API Management Service Name
		azureAgentValues.apiManagementServiceName = await askAzureApiManagementServiceName();
	}

	if (gatewayType === GatewayTypes.AZURE_EVENTHUB) {
		// Azure Event Hub Namespace
		azureAgentValues.eventHubNamespace = await askAzureEventHubNamespace();
	}
}

async function askTraceabilityPrompts(azureAgentValues: AzureAgentValues) {
	// Azure Event Hub Namespace
	azureAgentValues.eventHubNamespace = await askAzureEventHubNamespace();
	// Azure Event Hub Name
	azureAgentValues.eventHubName = await askAzureEventHubName();
	// Azure Policy Name
	azureAgentValues.policyName = await askAzurePolicyName();
	// Azure Policy Key
	azureAgentValues.policyKey = await askAzurePolicyKey();
}

export const completeInstall = async (installConfig: AgentInstallConfig): Promise<void> => {
	/**
	 * Create agent resources
	 */
	const azureAgentValues = installConfig.gatewayConfig as AzureAgentValues;

	// Add final settings to azureAgentsValues
	azureAgentValues.centralConfig = installConfig.centralConfig;
	azureAgentValues.traceabilityConfig = installConfig.traceabilityConfig;

	installConfig.log('Generating the configuration file(s)...');

	if (installConfig.switches.isDaEnabled) {
		writeTemplates(ConfigFiles.DAEnvVars, azureAgentValues, helpers.azureDAEnvVarTemplate);
	}

	if (installConfig.switches.isTaEnabled) {
		writeTemplates(ConfigFiles.TAEnvVars, azureAgentValues, helpers.azureTAEnvVarTemplate);
	}

	installConfig.log('Configuration file(s) have been successfully created.\n');

	generateSuccessHelpMsg(installConfig);
};

export const AzureInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	AgentNameMap: {
		[AgentTypes.da]: AgentNames.AZURE_DA,
		[AgentTypes.ta]: AgentNames.AZURE_TA,
	},
	GatewayDisplay: GatewayTypes.AZURE_GATEWAY,
};
