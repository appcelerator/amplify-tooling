import { InstallationFlowMethods } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BundleType, SaaSGatewayTypes } from '../../../types.js';
import { askList } from '../../basic-prompts.js';
import { AWSAgentValues } from '../index.js';
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

export const gatewayConnectivity = async (_installConfig: AgentInstallConfig): Promise<AWSAgentValues> => {
	const values: AWSAgentValues = new AWSAgentValues('');
	return values;
};

export const completeInstall = async (_installConfig: AgentInstallConfig): Promise<void> => {
};

export const AWSSaaSInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	AgentNameMap: {
		[AgentTypes.da]: AgentNames.AWS_DA,
		[AgentTypes.ta]: AgentNames.AWS_TA,
	},
	GatewayDisplay: SaaSGatewayTypes.AWS_GATEWAY,
};
