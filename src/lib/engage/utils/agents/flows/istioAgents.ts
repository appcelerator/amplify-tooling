import { InstallationFlowMethods } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, BundleType, GatewayTypes } from '../../../types.js';
import { askList } from '../../basic-prompts.js';
import * as helpers from '../index.js';
import { IstioValues } from '../index.js';

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
		choices: [ AgentConfigTypes.HELM ],
	})) as AgentConfigTypes;
};

export const gatewayConnectivity = async (_installConfig: AgentInstallConfig): Promise<IstioValues> => {
	const values: IstioValues = new IstioValues();
	return values;
};

export const completeInstall = async (_installConfig: AgentInstallConfig): Promise<void> => {
};

export const IstioInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	GatewayDisplay: GatewayTypes.ISTIO,
};
