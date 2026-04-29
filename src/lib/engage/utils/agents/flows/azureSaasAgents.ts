import { InstallationFlowMethods } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BundleType, GatewayTypes } from '../../../types.js';
import { askList } from '../../basic-prompts.js';
import { AzureAgentValues } from '../index.js';
import * as helpers from '../index.js';

export const askBundleType = async (): Promise<BundleType> => {
	return (await askList({
		msg: 'Select the type of agent(s) you want to install',
		choices: [ BundleType.ALL_AGENTS, BundleType.DISCOVERY, BundleType.TRACEABILITY ],
	})) as BundleType;
};

export const ConfigFiles = {
	agentEnvVars: `${helpers.configFiles.AGENT_ENV_VARS}`,
};

const prompts = {
	configTypeMsg: 'Select the mode of installation',
};

export const askConfigType = async (): Promise<AgentConfigTypes> => {
	return (await askList({
		msg: prompts.configTypeMsg,
		choices: [ AgentConfigTypes.HOSTED ],
	})) as AgentConfigTypes;
};

export const gatewayConnectivity = async (_installConfig: AgentInstallConfig): Promise<AzureAgentValues> => {
	const values: AzureAgentValues = new AzureAgentValues();
	return values;
};

export const completeInstall = async (_installConfig: AgentInstallConfig): Promise<void> => {
};

export const AzureSaaSInstallMethods: InstallationFlowMethods = {
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
