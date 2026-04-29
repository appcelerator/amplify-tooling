import { InstallationFlowMethods } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BundleType, GatewayTypes } from '../../../types.js';
import { askList } from '../../basic-prompts.js';
import { AWSAgentValues } from '../index.js';
import * as helpers from '../index.js';

// DeploymentTypes - ways the agents may be deployed with an AWS APIGW setup
export enum DeploymentTypes {
	EC2 = 'EC2',
	ECS_FARGATE = 'ECS Fargate',
	OTHER = 'Other',
}

// EC2InstanceTypes - instance types allowed in cloud formation document
// enum EC2InstanceTypes {
// 	T3_MICRO = 't3.micro',
// 	T3_NANO = 't3.nano',
// 	T3_SMALL = 't3.small',
// 	T3_MEDIUM = 't3.medium',
// 	T3_LARGE = 't3.large',
// 	T3_XLARGE = 't3.xlarge',
// 	T3_2XLARGE = 't3.2xlarge',
// }
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

export const gatewayConnectivity = async (_installConfig: AgentInstallConfig): Promise<AWSAgentValues> => {
	const values: AWSAgentValues = new AWSAgentValues('');
	return values;
};

export const completeInstall = async (_installConfig: AgentInstallConfig): Promise<void> => {
};

export const AWSInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	AgentNameMap: {
		[AgentTypes.da]: AgentNames.AWS_DA,
		[AgentTypes.ta]: AgentNames.AWS_TA,
	},
	GatewayDisplay: GatewayTypes.AWS_GATEWAY,
};
