import { InstallationFlowMethods } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BundleType, GatewayTypes } from '../../../types.js';
import { askList } from '../../basic-prompts.js';
import { AkamaiAgentValues } from '../index.js';
import * as helpers from '../index.js';

export const askBundleType = async (): Promise<BundleType> => {
	return  BundleType.TRACEABILITY as BundleType;
};

// ConfigFiles - all the config file that are used in the setup
export const ConfigFiles = {
	helmOverride: 'agent-overrides.yaml',
	agentEnvVars: `${helpers.configFiles.AGENT_ENV_VARS}`
};

const prompts = {
	configTypeMsg: 'Select the mode of installation',
	agentNamespace: 'Enter the namespace to use for the Amplify Akamai Agents',
	enterBaseUrl: 'Enter the Akamai Base URL',
	enterClientId: 'Enter the Akamai Client ID',
	enterClientSecret: 'Enter the Akamai Client Secret',
	enterSegmentLength: 'Enter the Akamai Segment Length',
	enterEnvironments: 'Enter an Akamai environment',
	enterMoreEnvironments: 'Do you want to enter another mapping?',
	selectCentralMappingEnvironment: 'Select an Engage environment to map to the provided Akamai environment',
	environmentsDescription: 'Configure a mapping of Akamai environment to Engage environment that the agent will use',
};

export const askConfigType = async (): Promise<AgentConfigTypes> => {
	return (await askList({
		msg: prompts.configTypeMsg,
		choices: [ AgentConfigTypes.DOCKERIZED, AgentConfigTypes.HELM ],
	})) as AgentConfigTypes;
};

export const gatewayConnectivity = async (_installConfig: AgentInstallConfig): Promise<AkamaiAgentValues> => {
	const akamaiAgentValues: AkamaiAgentValues = new AkamaiAgentValues();

	return akamaiAgentValues;
};

export const completeInstall = async (_installConfig: AgentInstallConfig): Promise<void> => {
};

export const AkamaiInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	AgentNameMap: {
		[AgentTypes.ca]: AgentNames.AKAMAI_CA,
	},
	GatewayDisplay: GatewayTypes.AKAMAI,
};
