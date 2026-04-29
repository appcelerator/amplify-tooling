import { InstallationFlowMethods } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BundleType, GatewayTypes } from '../../../types.js';
import { askList } from '../../basic-prompts.js';
import { GraylogAgentValues } from '../index.js';
import * as helpers from '../index.js';

export const askBundleType = async (): Promise<BundleType> => {
	return BundleType.TRACEABILITY as BundleType;
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

export const gatewayConnectivity = async (_installConfig: AgentInstallConfig): Promise<GraylogAgentValues> => {
	const values: GraylogAgentValues = new GraylogAgentValues();
	return values;
};

export const completeInstall = async (_installConfig: AgentInstallConfig): Promise<void> => {
};

export const GraylogInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	AgentNameMap: {
		[AgentTypes.ca]: AgentNames.GRAYLOG_CA,
	},
	GatewayDisplay: GatewayTypes.GRAYLOG,
};
