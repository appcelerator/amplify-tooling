import chalk from 'chalk';
import { ApiServerClient } from '../../../clients-external/apiserverclient.js';
import { DefinitionsManager } from '../../../results/DefinitionsManager.js';
import { InstallationFlowMethods, svcAccMsg } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BasePaths, BundleType, GatewayTypes, GenericResource, PublicDockerRepoBaseUrl, TraceableRegionType, YesNo, YesNoChoices } from '../../../types.js';
import { askInput, askList } from '../../basic-prompts.js';
import { AgentHelmInfo, helmImageSecretInfo, helmInstallInfo, isWindows, writeTemplates } from '../../utils.js';
import { TraceableAgentValues } from '../index.js';
import * as helpers from '../index.js';
import { kubectl } from '../kubectl.js';

const caImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.TRACEABLE_CA}`;
export const amplifyAgentsNs = 'amplify-agents';

// ConfigFiles - all the config file that are used in the setup
export const ConfigFiles = {
	helmOverride: 'agent-overrides.yaml',
	agentEnvVars: `${helpers.configFiles.AGENT_ENV_VARS}`
};

// TraceablePrompts - prompts for user inputs
const prompts = {
	configTypeMsg: 'Select the mode of installation',
	agentNamespace: 'Enter the namespace to use for the Amplify Traceable Agents',
	enterToken: 'Enter the token that the agent will use',
	enterRegion: 'Enter the region that the agent will use',
	enterEnvironments: 'Enter a Traceable environment',
	enterMoreEnvironments: 'Do you want to enter another mapping?',
	selectCentralMappingEnvironment: 'Select an Engage environment to map to the provided Traceable environment',
	environmentsDescription: 'Configure a mapping of Traceable environment to Engage environment that the agent will use',
};

export const askBundleType = async (): Promise<BundleType> => {
	return  BundleType.TRACEABILITY as BundleType;
};

export const askConfigType = async (): Promise<AgentConfigTypes> => {
	return (await askList({
		msg: prompts.configTypeMsg,
		choices: [ AgentConfigTypes.DOCKERIZED, AgentConfigTypes.HELM ],
	})) as AgentConfigTypes;
};

//
// Questions for the configuration of Traceable agent
//
const askToken = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterToken,
		allowEmptyInput: false,
	})) as string;

export const askTraceableRegion = async (): Promise<TraceableRegionType> => {
	return (await askList({
		msg: prompts.enterRegion,
		choices: Object.entries(TraceableRegionType).reduce((accumulator, curr) => {
			return accumulator.concat({
				name: curr[0],
				value: curr[1] as string,
			});
		}, [] as { name: string; value: string }[]),
		default: TraceableRegionType.US,
	})) as TraceableRegionType;
};

const askEnvironments = async (centralEnvs: GenericResource[], traceableAgentValues: TraceableAgentValues, excludeEnvironment?: string, log: (text: string) => void = () => {}): Promise<void> => {
	// Filter out the already-selected agent installation environment
	if (excludeEnvironment) {
		centralEnvs = centralEnvs.filter(env => env.name !== excludeEnvironment);
	}

	// If no central environments are available, exit the installation
	if (centralEnvs.length === 0) {
		log(chalk.red('Installation cannot proceed: No Engage environments are available for mapping.'));
		log(chalk.yellow('Please create at least one Engage environment before installing the Traceable agent.'));
		log(chalk.gray('You can create an environment using: axway engage create environment'));
		process.exit(1);
	}

	let askEnvs = true;
	const envs = [];
	const mappedCentralEnvs = [];
	log(chalk.gray(prompts.environmentsDescription));
	while (askEnvs) {
		const env = (await askInput({
			msg: prompts.enterEnvironments,
			allowEmptyInput: true,
		})) as string;

		if (envs.length === 0 && (!env || env.toString().trim() === '')) {
			break;
		}

		if (env && env.toString().trim() !== '') {
			envs.push(env);
		}
		const centralMappingEnv = await askList({
			msg: prompts.selectCentralMappingEnvironment,
			choices: centralEnvs.map((e) => e.name),
		});

		if (centralMappingEnv && centralMappingEnv.toString().trim() !== '') {
			mappedCentralEnvs.push(centralMappingEnv);
		}
		// Remove the selected environment from available choices for next iteration
		centralEnvs = centralEnvs.filter(env => env.name !== centralMappingEnv);

		// Only ask to continue if there are remaining central environments
		if (centralEnvs.length > 0) {
			askEnvs = await askList({
				msg: prompts.enterMoreEnvironments,
				default: YesNo.No,
				choices: YesNoChoices,
			}) === YesNo.Yes;
		} else {
			askEnvs = false; // Auto-stop when no environments remain
		}
	}
	traceableAgentValues.environments = envs;
	traceableAgentValues.centralEnvironments = mappedCentralEnvs;
};

export const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<TraceableAgentValues> => {
	const traceableAgentValues: TraceableAgentValues = new TraceableAgentValues();

	if (installConfig.switches.isHelmInstall) {
		installConfig.log(
			chalk.gray('The Amplify Traceable Agent needs to be deployed to your Kubernetes cluster to discover APIs for publishing to Amplify Central.')
		);
		const { error } = await kubectl.isInstalled();
		if (error) {
			throw new Error(
				`Kubectl is required to fill out the following prompts. It appears to be missing or misconfigured.\n${error}`
			);
		}
		traceableAgentValues.namespace = await helpers.askNamespace(prompts.agentNamespace, amplifyAgentsNs);
	}
	if (installConfig.switches.isDockerInstall) {
		installConfig.log('\nCONNECTION TO TRACEABLE API GATEWAY:');
		installConfig.log(
			chalk.gray('The Discovery Agent needs to connect to the Traceable API Gateway to discover API\'s for publishing to Amplify Central.')
		);
	}
	traceableAgentValues.traceableToken = await askToken();
	traceableAgentValues.traceableRegion = await askTraceableRegion();
	await helpers.getCentralEnvironments(installConfig.centralConfig.apiServerClient as ApiServerClient, installConfig.centralConfig.definitionManager as DefinitionsManager)
		.then(async envs => {
			// eslint-disable-next-line promise/always-return
			if (envs) {
			// Pass the already-selected agent installation environment to exclude it from mapping choices
				const agentInstallEnv = installConfig.centralConfig.ampcEnvInfo?.name;
				await askEnvironments(envs, traceableAgentValues, agentInstallEnv, installConfig.log);
			}
		});

	return traceableAgentValues;
};

const dockerSuccessMsg = (installConfig: AgentInstallConfig) => {
	let dockerInfo;
	const runAgentLinuxMsg = `docker run -it --env-file ${helpers.pwd}/${helpers.configFiles.AGENT_ENV_VARS} -v ${helpers.pwd}:/keys ${helpers.eolChar}`;
	const runAgentWinMsg = `docker run -it --env-file ${helpers.pwdWin}/${helpers.configFiles.AGENT_ENV_VARS} -v ${helpers.pwdWin}:/keys ${helpers.eolCharWin}`;
	const startAgentLinuxMsg = '\nStart the Traceable Agent on a Linux based machine';
	const startAgentWinMsg = '\nStart the Traceable Agent on a Windows machine';

	if (installConfig.switches.isTaEnabled) {
		dockerInfo = `To utilize the agent, pull the latest Docker image and run it using the appropriate supplied environment file, (${helpers.configFiles.AGENT_ENV_VARS}):`;
		installConfig.log(chalk.whiteBright(dockerInfo) + '\n');
		const caImageVersion = `${caImage}:${installConfig.taVersion}`;
		installConfig.log(chalk.white('Pull the latest image of the Agent:'));
		installConfig.log(chalk.cyan(`docker pull ${caImageVersion}`));
		installConfig.log(chalk.white(isWindows ? startAgentWinMsg : startAgentLinuxMsg));
		installConfig.log(chalk.cyan(isWindows ? runAgentWinMsg : runAgentLinuxMsg));
		installConfig.log('\t' + chalk.cyan(`-v /data ${caImageVersion}`) + '\n');
	}
};

const helmSuccessMsg = (namespace: string, log: (text: string) => void = () => {}) => {
	log(`Traceable Agent override file has been placed at ${process.cwd()}/${ConfigFiles.helmOverride}`);
	helmImageSecretInfo(namespace, log);

	const agentHelmInfo = new Set<AgentHelmInfo>();
	agentHelmInfo.add({
		helmReleaseName: 'traceable-agent',
		helmChartName: ' axway/traceable-agent',
		overrideFileName: ConfigFiles.helmOverride,
		imageSecretOverrides: '--set image.pullSecret=<image-pull-secret-name>' });

	helmInstallInfo(
		'Traceable',
		namespace,
		agentHelmInfo,
		log
	);
};

const generateSuccessHelpMsg = (installConfig: AgentInstallConfig) => {
	const traceableAgentValues = installConfig.gatewayConfig as TraceableAgentValues;
	const configType = installConfig.deploymentType;
	if (installConfig.centralConfig.ampcDosaInfo.isNew && !installConfig.switches.isHelmInstall) {
		installConfig.log(chalk.yellow(svcAccMsg));
	}
	if (configType === AgentConfigTypes.DOCKERIZED) {
		dockerSuccessMsg(installConfig);
	} else if (configType === AgentConfigTypes.HELM) {
		helmSuccessMsg(
			traceableAgentValues.namespace.name,
			installConfig.log
		);
	}

	installConfig.log('Configuration file(s) have been successfully created.\n');

	installConfig.log(
		chalk.gray(`\nAdditional information about agent features can be found here:\n${helpers.agentsDocsUrl.TRACEABLE}`)
	);
};

export const completeInstall = async (installConfig: AgentInstallConfig): Promise<void> => {
	// Add final settings to TraceableAgentValues
	const traceableAgentValues = installConfig.gatewayConfig as TraceableAgentValues;
	traceableAgentValues.centralConfig = installConfig.centralConfig;
	traceableAgentValues.traceabilityConfig = installConfig.traceabilityConfig;

	if (installConfig.switches.isHelmInstall) {
		traceableAgentValues.traceableSecret = helpers.amplifyAgentsCredsSecret;
		traceableAgentValues.agentKeysSecret = helpers.amplifyAgentsKeysSecret;
		if (traceableAgentValues.namespace.isNew) {
			await helpers.createNamespace(traceableAgentValues.namespace.name, installConfig.log);
		}
		await helpers.createSecret(traceableAgentValues.namespace.name, helpers.amplifyAgentsKeysSecret, async () => {
			if (installConfig.centralConfig.ampcDosaInfo.isNew) {
				installConfig.log(
					chalk.yellow(
						`The secret '${helpers.amplifyAgentsKeysSecret}' will be created with the same "private_key.pem" and "public_key.pem" that was auto generated to create the Service Account.`
					)
				);
			}

			await helpers.createAmplifyAgentKeysSecret(
				traceableAgentValues.namespace.name,
				helpers.amplifyAgentsKeysSecret,
				'publicKey',
				traceableAgentValues.centralConfig.dosaAccount.publicKey,
				'privateKey',
				traceableAgentValues.centralConfig.dosaAccount.privateKey,
				installConfig.log
			);
		});
		await helpers.createSecret(traceableAgentValues.namespace.name, helpers.amplifyAgentsCredsSecret, async () => {
			await createTraceableCredsSecret(
				traceableAgentValues.namespace.name,
				helpers.amplifyAgentsCredsSecret,
				traceableAgentValues.traceableToken,
				installConfig.log
			);
		});
	}

	installConfig.log('Generating the configuration file(s)...');
	if (installConfig.switches.isDockerInstall) {
		if (installConfig.switches.isTaEnabled) {
			writeTemplates(ConfigFiles.agentEnvVars, traceableAgentValues, helpers.traceableEnvVarTemplate);
		}
	} else if (installConfig.switches.isHelmInstall) {
		writeTemplates(ConfigFiles.helmOverride, traceableAgentValues, helpers.traceableHelmOverrideTemplate);
	}

	generateSuccessHelpMsg(installConfig);
};

const createTraceableCredsSecret = async (
	namespace: string,
	secretName: string,
	token: string,
	log: (text: string) => void = () => {}
): Promise<void> => {
	const { error } = await kubectl.create(
		'secret',
		`-n ${namespace} generic ${secretName} \
		--from-literal=token=${token} `
	);
	if (error) {
		throw Error(error);
	}
	log(`Created ${secretName} in the ${namespace} namespace.`);
};

export const TraceableInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	AgentNameMap: {
		[AgentTypes.ca]: AgentNames.TRACEABLE_CA,
	},
	GatewayDisplay: GatewayTypes.TRACEABLE,
};
