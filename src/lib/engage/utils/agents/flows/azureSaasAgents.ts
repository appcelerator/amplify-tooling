import chalk from 'chalk';
import logger from '../../../../logger.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, AzureDataplaneMode, BundleType, GatewayTypes, InstallationFlowMethods } from '../../../types.js';
import { askInput, askList, validateRegex } from '../../basic-prompts.js';
import * as helpers from '../index.js';
import { ApiServerClient } from '../../../clients-external/apiserverclient.js';
import { DefinitionsManager } from '../../../results/DefinitionsManager.js';
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

const debugLog = logger('engage: install: agents: saas');

const InvalidMessages = {
	enterApiManagementServiceName: 'The API Management Service Name can contain only letters, numbers and hyphens. The first character must be a letter and last character must be a letter or a number.',
};
class AzureDataplaneConfig extends DataplaneConfig {
	tenantId: string;
	resourceGroup: string;
	subscriptionId: string;
	apimServiceName: string;
	mode: AzureDataplaneMode;
	eventHubName?: string;
	eventHubNamespace?: string;
	eventHubConsumerGroup?: string;

	constructor(
		tenantId: string,
		resourceGroup: string,
		subscriptionId: string,
		apimServiceName: string,
		mode: AzureDataplaneMode,
		eventHubName?: string,
		eventHubNamespace?: string,
		eventHubConsumerGroup?: string,
	) {
		super('Azure');
		this.tenantId = tenantId;
		this.resourceGroup = resourceGroup;
		this.subscriptionId = subscriptionId;
		this.apimServiceName = apimServiceName;
		this.mode = mode;
		this.eventHubName = eventHubName;
		this.eventHubNamespace = eventHubNamespace;
		this.eventHubConsumerGroup = eventHubConsumerGroup;
	}
}

class SaasAzureAgentValues extends SaasAgentValues {
	clientID: string;
	clientSecret: string;
	sharedAccessKeyName: string;
	sharedAccessKeyValue: string;
	eventHubName: string;
	eventHubNamespace: string;
	eventHubConsumerGroup: string;
	resourceGroup: string;
	apimManagementServiceName: string;
	subscriptionId: string;
	tenantId: string;
	mode: AzureDataplaneMode;

	constructor() {
		super();
		this.clientID = '';
		this.clientSecret = '';
		this.sharedAccessKeyName = '';
		this.sharedAccessKeyValue = '';
		this.eventHubName = '';
		this.eventHubNamespace = '';
		this.eventHubConsumerGroup = '';
		this.resourceGroup = '';
		this.apimManagementServiceName = '';
		this.subscriptionId = '';
		this.tenantId = '';
		this.mode = AzureDataplaneMode.APIM;
	}

	override getAccessData(): string {
		return JSON.stringify({
			clientID: this.clientID,
			clientSecret: this.clientSecret,
			sharedAccessKeyName: this.sharedAccessKeyName,
			sharedAccessKeyValue: this.sharedAccessKeyValue,
		});
	}
}

const SaasPrompts = {
	TENANT_ID: 'Enter the Azure Tenant ID',
	SUBSCRIPTION_ID: 'Enter the Azure Subscription ID',
	CLIENT_ID: 'Enter the Azure Service Principal Client ID',
	CLIENT_SECRET: 'Enter the Azure Service Principal Client Secret',
	RESOURCE_GROUP_NAME: 'Enter the Azure Resource Group Name',
	APIM_SERVICE_MANAGEMENT_NAME: 'Enter the Azure API Management Service Name',
	SHARED_ACCESS_KEY_NAME: 'Enter the Azure Policy Name',
	SHARED_ACCESS_KEY_VALUE: 'Enter the Azure Policy Key',
	EVENT_HUB_NAME: 'Enter the Azure Event Hub Name',
	EVENT_HUB_NAMESPACE: 'Enter the Azure Event Hub Namespace',
	EVENT_HUB_CONSUMER_GROUP: 'Enter the Azure Event Hub Consumer Group',
};

export const askBundleType = async (gateway?: GatewayTypes): Promise<BundleType> => {
	if (gateway === GatewayTypes.AZURE_GATEWAY) {
		return (await askList({
			msg: helpers.agentMessages.selectAgentType,
			choices: [ BundleType.ALL_AGENTS, BundleType.DISCOVERY ],
		})) as BundleType;
	}
	return BundleType.DISCOVERY;
};

const askConfigType = async (): Promise<AgentConfigTypes> => {
	return AgentConfigTypes.HOSTED;
};

const askForAzureCredentials = async (
	agentValues: SaasAzureAgentValues,
	installConfig: AgentInstallConfig
): Promise<SaasAzureAgentValues> => {
	debugLog.log('gathering access details for azure');

	agentValues.tenantId = (await askInput({ msg: SaasPrompts.TENANT_ID })) as string;
	agentValues.subscriptionId = (await askInput({ msg: SaasPrompts.SUBSCRIPTION_ID })) as string;
	agentValues.clientID = (await askInput({ msg: SaasPrompts.CLIENT_ID })) as string;
	agentValues.clientSecret = (await askInput({ msg: SaasPrompts.CLIENT_SECRET })) as string;
	agentValues.resourceGroup = (await askInput({ msg: SaasPrompts.RESOURCE_GROUP_NAME })) as string;

	if (installConfig.gatewayType === GatewayTypes.AZURE_GATEWAY) {
		agentValues.apimManagementServiceName = (await askInput({
			msg: SaasPrompts.APIM_SERVICE_MANAGEMENT_NAME,
			validate: validateRegex(
				helpers.AzureRegexPatterns.azureApiManagementServiceNameRegex,
				InvalidMessages.enterApiManagementServiceName
			),
		})) as string;
	}

	if (installConfig.switches.isTaEnabled) {
		agentValues.sharedAccessKeyName = (await askInput({
			msg: SaasPrompts.SHARED_ACCESS_KEY_NAME,
			defaultValue: 'RootManageSharedAccessKey',
		})) as string;

		agentValues.sharedAccessKeyValue = (await askInput({ msg: SaasPrompts.SHARED_ACCESS_KEY_VALUE })) as string;
	}

	return agentValues;
};

export const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<SaasAgentValues> => {
	installConfig.log('\nCONNECTION TO Azure API GATEWAY:');
	installConfig.log(
		chalk.gray(
			'The Discovery Agent needs to connect to the Azure API Gateway to discover API\'s for publishing to Amplify Engage'
		)
	);

	let agentValues: SaasAgentValues = new SaasAgentValues();

	if (installConfig.gatewayType === GatewayTypes.AZURE_GATEWAY || installConfig.gatewayType === GatewayTypes.AZURE_EVENTHUB) {
		const azureValues = new SaasAzureAgentValues();
		agentValues = await askForAzureCredentials(azureValues, installConfig);

		if (installConfig.switches.isTaEnabled) {
			azureValues.eventHubName = (await askInput({ msg: SaasPrompts.EVENT_HUB_NAME })) as string;
			azureValues.eventHubNamespace = (await askInput({ msg: SaasPrompts.EVENT_HUB_NAMESPACE })) as string;
			azureValues.eventHubConsumerGroup = (await askInput({
				msg: SaasPrompts.EVENT_HUB_CONSUMER_GROUP,
				validate: validateRegex(
					helpers.AzureRegexPatterns.azureEventHubConsumerGroupRegex,
					helpers.invalidValueExampleErrMsg('Event Hub Consumer Group', 'azure-event-hub-c-group')
				),
				defaultValue: '$Default',
			})) as string;
		} else if (installConfig.gatewayType === GatewayTypes.AZURE_EVENTHUB) {
			azureValues.eventHubNamespace = (await askInput({ msg: SaasPrompts.EVENT_HUB_NAMESPACE })) as string;
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
	const azureAgentValues = installConfig.gatewayConfig as SaasAzureAgentValues;
	const resourceFuncsForCleanup: (() => Promise<void>)[] = [];
	const referencedIDPs: { name: string | undefined }[] = [];

	const ctx: CompleteInstallContext = {
		installConfig,
		agentValues: azureAgentValues,
		apiServerClient: apiServerClient as ApiServerClient,
		defsManager: defsManager as DefinitionsManager,
		resourceFuncsForCleanup,
		referencedIDPs,
	};

	if (!await createIDPResources(ctx)) {
		return;
	}
	await setupEnvironment(ctx);

	if (installConfig.gatewayType === GatewayTypes.AZURE_GATEWAY) {
		azureAgentValues.dataplaneConfig = new AzureDataplaneConfig(
			azureAgentValues.tenantId,
			azureAgentValues.resourceGroup,
			azureAgentValues.subscriptionId,
			azureAgentValues.apimManagementServiceName,
			AzureDataplaneMode.APIM,
			installConfig.switches.isTaEnabled ? azureAgentValues.eventHubName : undefined,
			installConfig.switches.isTaEnabled ? azureAgentValues.eventHubNamespace : undefined,
			installConfig.switches.isTaEnabled ? azureAgentValues.eventHubConsumerGroup : undefined,
		);
	} else if (installConfig.gatewayType === GatewayTypes.AZURE_EVENTHUB) {
		azureAgentValues.dataplaneConfig = new AzureDataplaneConfig(
			azureAgentValues.tenantId,
			azureAgentValues.resourceGroup,
			azureAgentValues.subscriptionId,
			'',
			AzureDataplaneMode.EventHub,
			undefined,
			azureAgentValues.eventHubNamespace
		);
	}

	const dataplaneRes = await createDataplaneResources(ctx, azureAgentValues.dataplaneConfig);
	if (!dataplaneRes) {
		return;
	}

	await createAgentResources(ctx, dataplaneRes, { sampling: azureAgentValues.sampling, redaction: azureAgentValues.redaction });

	installConfig.log(`Install complete of hosted agent for ${installConfig.gatewayType} region`);
};

export const AzureSaaSInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	AddIDP: true,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: [],
	AgentNameMap: {
		[AgentTypes.da]: AgentNames.AZURE_DA,
		[AgentTypes.ta]: AgentNames.AZURE_TA,
	},
	GatewayDisplay: GatewayTypes.AZURE_GATEWAY,
};
