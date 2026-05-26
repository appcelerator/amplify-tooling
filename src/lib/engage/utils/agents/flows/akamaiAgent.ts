import chalk from 'chalk';
import { ApiServerClient } from '../../../clients-external/apiserverclient.js';
import { DefinitionsManager } from '../../../results/DefinitionsManager.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BasePaths, BundleType, GatewayTypes, GenericResource, InstallationFlowMethods, PublicDockerRepoBaseUrl, svcAccMsg, YesNo, YesNoChoices } from '../../../types.js';
import { askInput, askList, validateRegex, validateValueRange } from '../../basic-prompts.js';
import { AgentHelmInfo, helmImageSecretInfo, helmInstallInfo, isWindows, writeTemplates } from '../../utils.js';
import { AkamaiAgentValues } from '../index.js';
import * as helpers from '../index.js';
import { kubectl } from '../kubectl.js';

const caImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.AKAMAI_CA}`;
export const amplifyAgentsNs = 'amplify-agents';

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
// Questions for the configuration of Akamai agents
//
const askAkamaiBaseUrl = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterBaseUrl,
		validate: validateRegex(
			helpers.AkamaiRegexPatterns.baseURLRegex,
			helpers.invalidValueExampleErrMsg('baseURL', 'https://akamai.com'),
		),
	})) as string;

const askAkamaiClientId = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterClientId,
	})) as string;

const askAkamaiClientSecret = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterClientSecret,
	})) as string;

const askAkamaiSegmentLength = async (): Promise<number> =>
	(await askInput({
		msg: prompts.enterSegmentLength,
		type: 'number',
		validate: validateValueRange(0),
	})) as number;

const askEnvironments = async (centralEnvs: GenericResource[], akamaiAgentValues: AkamaiAgentValues, excludeEnvironment?: string, log: (text: string) => void = () => {}): Promise<void> => {
	// Filter out the already-selected agent installation environment
	if (excludeEnvironment) {
		centralEnvs = centralEnvs.filter(env => env.name !== excludeEnvironment);
	}

	// If no central environments are available, exit the installation
	if (centralEnvs.length === 0) {
		log(chalk.red('Installation cannot proceed: No Engage environments are available for mapping.'));
		log(chalk.yellow('Please create at least one Engage environment before installing the Akamai agent.'));
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

	akamaiAgentValues.environments = envs;
	akamaiAgentValues.centralEnvironments = mappedCentralEnvs;
};

export const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<AkamaiAgentValues> => {
	const akamaiAgentValues: AkamaiAgentValues = new AkamaiAgentValues();

	if (installConfig.switches.isHelmInstall) {
		installConfig.log(
			chalk.gray('The Amplify Akamai Agent needs to be deployed to your Kubernetes cluster to discover APIs for publishing to Amplify Central.')
		);
		const { error } = await kubectl.isInstalled();
		if (error) {
			throw new Error(
				`Kubectl is required to fill out the following prompts. It appears to be missing or misconfigured.\n${error}`
			);
		}
		akamaiAgentValues.namespace = await helpers.askNamespace(prompts.agentNamespace, amplifyAgentsNs);
	}

	if (installConfig.switches.isDockerInstall) {
		installConfig.log('\nCONNECTION TO AKAMAI API GATEWAY:');
		installConfig.log(
			chalk.gray('The Compliance Agent needs to connect to the Akamai API Gateway to discover API\'s for publishing to Amplify Central.')
		);
	}

	akamaiAgentValues.baseUrl = await askAkamaiBaseUrl();
	akamaiAgentValues.clientId = await askAkamaiClientId();
	akamaiAgentValues.clientSecret = await askAkamaiClientSecret();
	akamaiAgentValues.segmentLength = await askAkamaiSegmentLength();
	await helpers.getCentralEnvironments(installConfig.centralConfig.apiServerClient as ApiServerClient, installConfig.centralConfig.definitionManager as DefinitionsManager)
		.then(async envs => {
			// eslint-disable-next-line promise/always-return
			if (envs) {
				// Pass the already-selected agent installation environment to exclude it from mapping choices
				const agentInstallEnv = installConfig.centralConfig.ampcEnvInfo?.name;
				await askEnvironments(envs, akamaiAgentValues, agentInstallEnv, installConfig.log);
			}
		});

	return akamaiAgentValues;
};

const dockerSuccessMsg = (installConfig: AgentInstallConfig) => {
	const runAgentLinuxMsg = `docker run -it --env-file ${helpers.pwd}/${helpers.configFiles.AGENT_ENV_VARS} -v ${helpers.pwd}:/keys ${helpers.eolChar}`;
	const runAgentWinMsg = `docker run -it --env-file ${helpers.pwdWin}/${helpers.configFiles.AGENT_ENV_VARS} -v ${helpers.pwdWin}:/keys ${helpers.eolCharWin}`;
	const startAgentLinuxMsg = '\nStart the Akamai Agent on a Linux based machine';
	const startAgentWinMsg = '\nStart the Akamai Agent on a Windows machine';

	const dockerInfo = `To utilize the agent, pull the latest Docker image and run it using the appropriate supplied environment file, (${helpers.configFiles.AGENT_ENV_VARS}):`;
	installConfig.log(chalk.whiteBright(dockerInfo) + '\n');
	const caImageVersion = `${caImage}:${installConfig.caVersion}`;
	installConfig.log(chalk.white('Pull the latest image of the Agent:'));
	installConfig.log(chalk.cyan(`docker pull ${caImageVersion}`));
	installConfig.log(chalk.white(isWindows ? startAgentWinMsg : startAgentLinuxMsg));
	installConfig.log(chalk.cyan(isWindows ? runAgentWinMsg : runAgentLinuxMsg));
	installConfig.log('\t' + chalk.cyan(`-v /data ${caImageVersion}`) + '\n');
};

const helmSuccessMsg = (namespace: string, log: (text: string) => void = () => {}) => {
	log(`Akamai Agent override file has been placed at ${process.cwd()}/${ConfigFiles.helmOverride}`);
	helmImageSecretInfo(namespace, log);

	const agentHelmInfo = new Set<AgentHelmInfo>();
	agentHelmInfo.add({
		helmReleaseName: 'akamai-agent',
		helmChartName: ' axway/akamai-agent',
		overrideFileName: ConfigFiles.helmOverride,
		imageSecretOverrides: '--set image.pullSecret=<image-pull-secret-name>' });

	helmInstallInfo(
		'Akamai',
		namespace,
		agentHelmInfo,
		log
	);
};

const generateSuccessHelpMsg = (installConfig: AgentInstallConfig) => {
	const akamaiAgentValues = installConfig.gatewayConfig as AkamaiAgentValues;
	const configType = installConfig.deploymentType;

	if (installConfig.centralConfig.ampcDosaInfo.isNew && !installConfig.switches.isHelmInstall) {
		installConfig.log(chalk.yellow(svcAccMsg));
	}

	if (configType === AgentConfigTypes.DOCKERIZED) {
		dockerSuccessMsg(installConfig);
	} else if (configType === AgentConfigTypes.HELM) {
		helmSuccessMsg(
			akamaiAgentValues.namespace.name,
			installConfig.log
		);
	}

	installConfig.log('Configuration file(s) have been successfully created.\n');

	installConfig.log(
		chalk.gray(`\nAdditional information about agent features can be found here:\n${helpers.agentsDocsUrl.AKAMAI}`)
	);
};

export const completeInstall = async (installConfig: AgentInstallConfig): Promise<void> => {
	// Add final settings to AkamaiAgentValues
	const akamaiAgentValues = installConfig.gatewayConfig as AkamaiAgentValues;
	akamaiAgentValues.centralConfig = installConfig.centralConfig;
	akamaiAgentValues.traceabilityConfig = installConfig.traceabilityConfig;

	if (installConfig.switches.isHelmInstall) {
		akamaiAgentValues.akamaiSecret = helpers.amplifyAgentsCredsSecret;
		akamaiAgentValues.agentKeysSecret = helpers.amplifyAgentsKeysSecret;
		if (akamaiAgentValues.namespace.isNew) {
			await helpers.createNamespace(akamaiAgentValues.namespace.name, installConfig.log);
		}
		await helpers.createSecret(akamaiAgentValues.namespace.name, helpers.amplifyAgentsKeysSecret, async () => {
			if (installConfig.centralConfig.ampcDosaInfo.isNew) {
				installConfig.log(
					chalk.yellow(
						`The secret '${helpers.amplifyAgentsKeysSecret}' will be created with the same "private_key.pem" and "public_key.pem" that was auto generated to create the Service Account.`
					)
				);
			}

			await helpers.createAmplifyAgentKeysSecret(
				akamaiAgentValues.namespace.name,
				helpers.amplifyAgentsKeysSecret,
				'publicKey',
				akamaiAgentValues.centralConfig.dosaAccount.publicKey,
				'privateKey',
				akamaiAgentValues.centralConfig.dosaAccount.privateKey,
				installConfig.log
			);
		});
		await helpers.createSecret(akamaiAgentValues.namespace.name, helpers.amplifyAgentsCredsSecret, async () => {
			await createAkamaiCredsSecret(
				akamaiAgentValues.namespace.name,
				helpers.amplifyAgentsCredsSecret,
				akamaiAgentValues.akamaiSecret,
				akamaiAgentValues.agentKeysSecret,
				installConfig.log
			);
		});
	}

	installConfig.log('Generating the configuration file(s)...');
	if (installConfig.switches.isDockerInstall) {
		writeTemplates(ConfigFiles.agentEnvVars, akamaiAgentValues, helpers.akamaiEnvVarTemplate);
	} else if (installConfig.switches.isHelmInstall) {
		writeTemplates(ConfigFiles.helmOverride, akamaiAgentValues, helpers.akamaiHelmOverrideTemplate);
	}

	generateSuccessHelpMsg(installConfig);
};

const createAkamaiCredsSecret = async (
	namespace: string,
	secretName: string,
	clientID: string,
	clientSecret: string,
	log: (text: string) => void = () => {},
): Promise<void> => {
	const { error } = await kubectl.create(
		'secret',
		`-n ${namespace} generic ${secretName} \
		--from-literal=clientID=${clientID} \
		--from-literal=clientSecret=${clientSecret}`
	);
	if (error) {
		throw Error(error);
	}
	log(`Created ${secretName} in the ${namespace} namespace.`);
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

