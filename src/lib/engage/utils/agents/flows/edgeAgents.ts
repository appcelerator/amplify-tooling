import { InstallationFlowMethods } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BundleType, GatewayTypes } from '../../../types.js';
import { askList } from '../../basic-prompts.js';
import { V7AgentValues } from '../index.js';
import * as helpers from '../index.js';

export const askBundleType = async (): Promise<BundleType> => {
	return (await askList({
		msg: 'Select the type of agent(s) you want to install',
		choices: [ BundleType.ALL_AGENTS, BundleType.DISCOVERY, BundleType.TRACEABILITY ],
	})) as BundleType;
};

export const askIsGatewayOnlyMode = async (): Promise<GatewayTypes> => {
	return (await askList({
		msg: 'Select the gateway mode',
		choices: [ GatewayTypes.EDGE_GATEWAY, GatewayTypes.EDGE_GATEWAY_ONLY ],
	})) as GatewayTypes;
};

export const askOrganizationReplication = async (): Promise<boolean> => {
	const answer = await askList({
		msg: 'Would you like to replicate the organization structure?',
		choices: [ 'Yes', 'No' ],
	});
	return answer === 'Yes';
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

export const gatewayConnectivity = async (_installConfig: AgentInstallConfig): Promise<V7AgentValues> => {
	const values: V7AgentValues = new V7AgentValues();
	return values;
};

export const completeInstall = async (_installConfig: AgentInstallConfig): Promise<void> => {
};

export const EdgeInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	AgentNameMap: {
		[AgentTypes.da]: AgentNames.EDGE_DA,
		[AgentTypes.ta]: AgentNames.EDGE_TA,
	},
	GatewayDisplay: GatewayTypes.EDGE_GATEWAY,
};

export const EdgeGWOnlyInstallMethods: InstallationFlowMethods = {
	...EdgeInstallMethods,
	GatewayDisplay: GatewayTypes.EDGE_GATEWAY_ONLY,
};
