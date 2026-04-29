import { InstallationFlowMethods } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BundleType, GatewayTypes } from '../../../types.js';
import { askList } from '../../basic-prompts.js';
import { WSO2AgentValues } from '../templates/wso2Templates.js';
import * as helpers from '../index.js';

export const askBundleType = async (): Promise<BundleType> => {
	return (await askList({
		msg: 'Select the type of agent(s) you want to install',
		choices: [ BundleType.ALL_AGENTS, BundleType.DISCOVERY, BundleType.TRACEABILITY ],
	})) as BundleType;
};

export const ConfigFiles = {
	helmOverride: 'agent-overrides.yaml',
	agentEnvVars: `${helpers.configFiles.AGENT_ENV_VARS}`,
};

const prompts = {
	configTypeMsg: 'Select the mode of installation',
};

export const askConfigType = async (): Promise<AgentConfigTypes> => {
	return (await askList({
		msg: prompts.configTypeMsg,
		choices: [ AgentConfigTypes.DOCKERIZED, AgentConfigTypes.HELM, AgentConfigTypes.BINARIES ],
	})) as AgentConfigTypes;
};

export const gatewayConnectivity = async (_installConfig: AgentInstallConfig): Promise<WSO2AgentValues> => {
	const values: WSO2AgentValues = new WSO2AgentValues();
	return values;
};

export const completeInstall = async (_installConfig: AgentInstallConfig): Promise<void> => {
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
