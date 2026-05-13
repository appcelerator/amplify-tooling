import chalk from 'chalk';
import fs from 'fs';
import { dataService } from '../../../../request.js';
import { InstallationFlowMethods, localhost, svcAccMsg } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BasePaths, BundleType, GatewayTypes, LoggingSource, PublicDockerRepoBaseUrl, PublicRepoUrl, YesNo, YesNoChoices } from '../../../types.js';
import { askInput, askList, askUsernameAndPassword } from '../../basic-prompts.js';
import { writeTemplates, isWindows, AgentHelmInfo } from '../../utils.js';
import { V7AgentValues } from '../index.js';
import * as helpers from '../index.js';
import { kubectl } from '../kubectl.js';
import { amplifyAgentsNs } from './akamaiAgent.js';
import { Account } from '../../../../../types.js';

const defaultLogFiles = '/group-*_instance-*.log';
const defaultOTLogFiles = '/group-*_instance-*_traffic*.log';
export const dockerPrivateKey = '/keys/private_key.pem';
export const dockerPublicKey = '/keys/public_key.pem';

const daImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.EDGE_DA}`;
const taImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.EDGE_TA}`;

// ConfigFiles - all the config file that are used in the setup
export const ConfigFiles = {
	DAEnvVars: `${helpers.configFiles.DA_ENV_VARS}`,
	DAHelmOverride: 'da-overrides.yaml',
	EdgeDABinaryFile: 'discovery_agent',
	EdgeDAYaml: 'discovery_agent.yml',
	EdgeTABinaryFile: 'traceability_agent',
	EdgeTAYaml: 'traceability_agent.yml',
	TAEnvVars: `${helpers.configFiles.TA_ENV_VARS}`,
	TAHelmOverride: 'ta-overrides.yaml',
};

export const prompts = {
	configTypeMsg: 'Select the mode of installation',
	askApiGatewayHost: 'Enter the API Gateway hostname',
	askApiGatewayPort: 'Enter the API Gateway port',
	askApiManagerHost: 'Enter the API Manager hostname',
	askApiManagerPort: 'Enter the API Manager port',
	askLoggingSource: 'What is the source of logging for the traceability agent',
	askEventsPath: 'Enter the path to the API Gateway event log directory',
	askOpenTrafficPath: 'Enter the path to the API Gateway open traffic log directory',
	enterGatewayAgentNs: 'Enter the namespace to use for the Amplify Gateway Agents',
	enterGatewayManagerMode: 'Do you want to use API Manager with the API Gateway',
	askIfOrgReplication:
		'Do you want to replicate your original organization structure for your newly discovered APIs? If yes, make sure the organization names match the team names that are created in Amplify platform',
};

const downloadV7AgentBundle = async (account: Account, type: BundleType, version: string): Promise<string> => {
	const fileName
		= type === BundleType.DISCOVERY ? `discovery_agent-${version}.zip` : `traceability_agent-${version}.zip`;
	const url
		= type === BundleType.DISCOVERY
			? `${BasePaths.V7Agents}/v7_discovery_agent/${version}/discovery_agent-${version}.zip`
			: `${BasePaths.V7Agents}/v7_traceability_agent/${version}/traceability_agent-${version}.zip`;
	const service = await dataService({
		baseUrl: PublicRepoUrl,
	});
	try {
		const { stream } = await service.download(url);
		await helpers.streamPipeline(stream, fs.createWriteStream(fileName));
		return fileName;
	} catch (err: any) {
		throw new Error(`Failed to download the agent: ${err.message}`);
	}
};

const downloadBinary = async (account: Account, bundleType: BundleType, version: string) => {
	const fileName = await downloadV7AgentBundle(account, bundleType, version);
	await helpers.unzip(fileName);
	fs.unlinkSync(fileName);
};

const downloadBinaries = async (installConfig: AgentInstallConfig) => {
	const account = installConfig.centralConfig.apiServerClient?.account;
	if (!account) {
		throw new Error('Unable to resolve account for DataService call during AWS agent install preprocess');
	}
	console.log('Downloading and unpacking binary files...');
	if (installConfig.switches.isDaEnabled) {
		await downloadBinary(account, BundleType.DISCOVERY, installConfig.daVersion);
	}
	if (installConfig.switches.isTaEnabled) {
		await downloadBinary(account, BundleType.TRACEABILITY, installConfig.taVersion);
	}
	console.log('Downloading and unpacking is complete.');
};

export const askIsGatewayOnlyMode = async (): Promise<GatewayTypes> => {
	const mode = await askList({
		msg: prompts.enterGatewayManagerMode,
		default: YesNo.Yes,
		choices: YesNoChoices,
	});
	return mode === YesNo.Yes ? GatewayTypes.EDGE_GATEWAY : GatewayTypes.EDGE_GATEWAY_ONLY;
};

export const askOrganizationReplication = async (): Promise<boolean> => {
	const mode = await askList({
		msg: prompts.askIfOrgReplication,
		default: YesNo.Yes,
		choices: YesNoChoices,
	});
	return mode === YesNo.Yes;
};

export const askBundleType = async (): Promise<BundleType> => {
	return (await askList({
		msg: helpers.agentMessages.selectAgentType,
		choices: [ BundleType.ALL_AGENTS, BundleType.DISCOVERY, BundleType.TRACEABILITY ],
	})) as BundleType;
};

export const askBundleTypeGWOnly = async (): Promise<BundleType> => {
	return (await askList({
		msg: helpers.agentMessages.selectAgentType,
		choices: [ BundleType.TRACEABILITY, BundleType.TRACEABILITY_OFFLINE ],
	})) as BundleType;
};

export const askConfigType = async (): Promise<AgentConfigTypes> => {
	return (await askList({
		msg: prompts.configTypeMsg,
		choices: [ AgentConfigTypes.BINARIES, AgentConfigTypes.DOCKERIZED, AgentConfigTypes.HELM ],
	})) as AgentConfigTypes;
};

const askLoggingSource = async (): Promise<boolean> => {
	console.log(
		chalk.white('\nThe API Gateway can provide the API traffic either within event logs or open traffic logs.')
	);
	return (
		(await askList({
			msg: prompts.askLoggingSource,
			default: LoggingSource.Event,
			choices: [ LoggingSource.Event, LoggingSource.OpenTraffic ],
		})) === LoggingSource.OpenTraffic
	);
};

const askEventsPath = async (isOpenTraffic: boolean): Promise<string> => {
	return (await askInput({
		msg: isOpenTraffic ? prompts.askOpenTrafficPath : prompts.askEventsPath,
		defaultValue: isOpenTraffic ? '/apigateway/logs/opentraffic' : '/apigateway/events',
		type: 'string',
	})) as string;
};

const askApiManagerHost = async (): Promise<string> => {
	return (await askInput({
		msg: prompts.askApiManagerHost,
		defaultValue: localhost,
	})) as string;
};

const askApiManagerPort = async (): Promise<string> => {
	return (await askInput({
		msg: prompts.askApiManagerPort,
		defaultValue: 8075,
		type: 'number',
	})) as string;
};

const askApiGatewayHost = async (): Promise<string> => {
	return (await askInput({
		msg: prompts.askApiGatewayHost,
		defaultValue: localhost,
	})) as string;
};

const askApiGatewayPort = async (): Promise<string> => {
	return (await askInput({
		msg: prompts.askApiGatewayPort,
		defaultValue: 8090,
		type: 'number',
	})) as string;
};

export const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<V7AgentValues> => {
	const v7AgentValues: V7AgentValues = new V7AgentValues();

	if (installConfig.switches.isHelmInstall) {
		const { error } = await kubectl.isInstalled();
		if (error) {
			throw new Error(
				`Kubectl is required to fill out the following prompts. It appears to be missing or misconfigured.\n${error}`
			);
		}
	}

	if (!installConfig.switches.isGatewayOnly || installConfig.switches.isDaEnabled) {
		console.log('\nCONNECTION TO API MANAGER:');
		console.log(
			chalk.gray(
				'The agents need to connect to the Axway API Manager to discover APIs for publishing to Amplify.\n'
					+ 'Use the credentials of an API Manager Administrator user or an Organization Administrator user.'
			)
		);

		if (installConfig.switches.isHelmInstall) {
			console.log(chalk.white('Please use the name of the API Manager Service as hostname.'));
		}

		v7AgentValues.apiManagerHost = await askApiManagerHost();
		v7AgentValues.apiManagerPort = await askApiManagerPort();

		const apimCreds = await askUsernameAndPassword('the API Manager', 'apiadmin');
		v7AgentValues.apiManagerAuthUser = apimCreds.username;
		v7AgentValues.apiManagerAuthPass = apimCreds.password;
	}

	if (installConfig.switches.isTaEnabled) {
		v7AgentValues.isOpenTraffic = await askLoggingSource();

		if (!v7AgentValues.isOpenTraffic && installConfig.bundleType !== BundleType.TRACEABILITY_OFFLINE) {
			console.log('\nCONNECTION TO API GATEWAY:');
			console.log(
				chalk.gray(
					'The traceability agent needs to connect to Axway API Gateway.\n'
					+ 'Use the credentials of an Operator user.'
				)
			);

			if (installConfig.switches.isHelmInstall) {
				console.log(chalk.white('Please use the name of the API Gateway Service as hostname.'));
			}

			v7AgentValues.apiGatewayHost = await askApiGatewayHost();
			v7AgentValues.apiGatewayPort = await askApiGatewayPort();

			const apigwCreds = await askUsernameAndPassword('the API Gateway', 'admin');
			v7AgentValues.apiGatewayAuthUser = apigwCreds.username;
			v7AgentValues.apiGatewayAuthPass = apigwCreds.password;
		}

		if (installConfig.switches.isBinaryInstall || installConfig.switches.isDockerInstall) {
			const eventLogPaths = await askEventsPath(v7AgentValues.isOpenTraffic);
			const trimmedDir = eventLogPaths.trim();
			v7AgentValues.eventLogPath = eventLogPaths
				? trimmedDir[trimmedDir.length - 1] === '/'
					? `${trimmedDir.slice(0, -1)}`
					: `${trimmedDir}`
				: '';
			v7AgentValues.eventLogPathTemplate = installConfig.switches.isBinaryInstall
				? `${v7AgentValues.eventLogPath}${v7AgentValues.isOpenTraffic ? defaultOTLogFiles : defaultLogFiles}`
				: '';
		}
	}

	if (installConfig.switches.isHelmInstall) {
		v7AgentValues.namespace = await helpers.askNamespace(prompts.enterGatewayAgentNs, amplifyAgentsNs);
	}

	return v7AgentValues;
};

const generateSuccessHelpMsg = (installConfig: AgentInstallConfig) => {
	const v7AgentValues = installConfig.gatewayConfig as V7AgentValues;
	const configType = installConfig.deploymentType;
	const trimmedDir = v7AgentValues.eventLogPath?.trim();
	const verifiedEventsPath = v7AgentValues.eventLogPath
		? trimmedDir[trimmedDir.length - 1] === '/'
			? `${trimmedDir.slice(0, -1)}:/events`
			: `${trimmedDir}:/events`
		: '';

	if (installConfig.centralConfig.ampcDosaInfo.isNew && !installConfig.switches.isHelmInstall) {
		console.log(chalk.yellow(svcAccMsg));
	}

	if (configType === AgentConfigTypes.BINARIES) {
		binarySuccessMsg(
			installConfig.centralConfig.ampcDosaInfo.isNew,
			installConfig.switches.isDaEnabled,
			installConfig.switches.isTaEnabled
		);
	} else if (configType === AgentConfigTypes.DOCKERIZED) {
		dockerSuccessMsg(installConfig, verifiedEventsPath);
	} else if (installConfig.switches.isHelmInstall) {
		helmSuccessMsg(
			v7AgentValues.namespace.name,
			installConfig.switches.isDaEnabled,
			installConfig.switches.isTaEnabled
		);
	}

	console.log(
		chalk.gray(`\nAdditional information about agent features can be found here:\n${helpers.agentsDocsUrl.V7}`)
	);
};

export const installPreprocess = async (installConfig: AgentInstallConfig): Promise<AgentInstallConfig> => {
	// Ask for key paths if HELM, and dosa NOT new
	if (installConfig.deploymentType === AgentConfigTypes.HELM && !installConfig.centralConfig.ampcDosaInfo.isNew) {
		[ installConfig.centralConfig.dosaAccount.publicKey, installConfig.centralConfig.dosaAccount.privateKey ]
			= await helpers.askPublicAndPrivateKeysPath();
	}

	// attempt to download the binaries prior to creating resources
	if (installConfig.switches.isBinaryInstall) {
		await downloadBinaries(installConfig);
	}

	return installConfig;
};

export const completeInstall = async (installConfig: AgentInstallConfig): Promise<void> => {
	/**
	 * Create agent resources
	 */
	const v7AgentValues = installConfig.gatewayConfig as V7AgentValues;

	// Add final settings to v7AgentsValues
	v7AgentValues.centralConfig = installConfig.centralConfig;
	v7AgentValues.traceabilityConfig = installConfig.traceabilityConfig;
	v7AgentValues.isGatewayOnly = installConfig.switches.isGatewayOnly;
	v7AgentValues.daVersion = installConfig.daVersion;
	v7AgentValues.taVersion = installConfig.taVersion;

	if (installConfig.switches.isHelmInstall) {
		if (v7AgentValues.namespace.isNew) {
			await helpers.createNamespace(v7AgentValues.namespace.name);
		}
		await helpers.createSecret(v7AgentValues.namespace.name, helpers.amplifyAgentsKeysSecret, async () => {
			if (installConfig.centralConfig.ampcDosaInfo.isNew) {
				console.log(
					chalk.yellow(
						`The secret '${helpers.amplifyAgentsKeysSecret}' will be created with the same "private_key.pem" and "public_key.pem" that was auto generated to create the Service Account.`
					)
				);
			}

			await helpers.createAmplifyAgentKeysSecret(
				v7AgentValues.namespace.name,
				helpers.amplifyAgentsKeysSecret,
				'public_key',
				v7AgentValues.centralConfig.dosaAccount.publicKey,
				'private_key',
				v7AgentValues.centralConfig.dosaAccount.privateKey
			);
		});
		await helpers.createSecret(v7AgentValues.namespace.name, helpers.amplifyAgentsCredsSecret, async () => {
			await helpers.createGatewayAgentCredsSecret(
				v7AgentValues.namespace.name,
				helpers.amplifyAgentsCredsSecret,
				v7AgentValues.apiManagerAuthUser,
				v7AgentValues.apiManagerAuthPass,
				v7AgentValues.apiGatewayAuthUser,
				v7AgentValues.apiGatewayAuthPass
			);
		});
	}

	console.log('Generating the configuration file(s)...');

	if (installConfig.switches.isHelmInstall) {
		if (installConfig.switches.isDaEnabled) {
			writeTemplates(ConfigFiles.DAHelmOverride, v7AgentValues, helpers.v7DAHelmOverrideTemplate);
		}

		if (installConfig.switches.isTaEnabled) {
			writeTemplates(ConfigFiles.TAHelmOverride, v7AgentValues, helpers.v7TAHelmOverrideTemplate);
		}
	} else {
		if (installConfig.switches.isDaEnabled) {
			writeTemplates(ConfigFiles.DAEnvVars, v7AgentValues, helpers.v7DAEnvVarTemplate);
		}

		if (installConfig.switches.isTaEnabled) {
			writeTemplates(ConfigFiles.TAEnvVars, v7AgentValues, helpers.v7TAEnvVarTemplate);
		}
	}

	console.log('Configuration file(s) have been successfully created.\n');

	generateSuccessHelpMsg(installConfig);
};

const dockerSuccessMsg = (installConfig: AgentInstallConfig, eventLogPath: string) => {
	let dockerInfo;
	const runDaLinuxMsg = `docker run -it --env-file ${helpers.pwd}/${helpers.configFiles.DA_ENV_VARS} -v ${helpers.pwd}:/keys ${helpers.eolChar}`;
	const runDaWinMsg = `docker run -it --env-file ${helpers.pwdWin}/${helpers.configFiles.DA_ENV_VARS} -v ${helpers.pwdWin}:/keys ${helpers.eolCharWin}`;
	const runTaLinuxMsg = `docker run -it --env-file ${helpers.pwd}/${helpers.configFiles.TA_ENV_VARS} -v ${helpers.pwd}:/keys ${helpers.eolChar}`;
	const runTaWinMsg = `docker run -it --env-file ${helpers.pwdWin}/${helpers.configFiles.TA_ENV_VARS} -v ${helpers.pwdWin}:/keys ${helpers.eolCharWin}`;
	const startDaLinuxMsg = '\nStart the Discovery Agent on a Linux based machine';
	const startDaWinMsg = '\nStart the Discovery Agent on a Windows machine';
	const startTaLinuxMsg = '\nStart the Traceability Agent on a Linux based machine';
	const startTaWinMsg = '\nStart the Traceability Agent on a Windows machine';

	if (installConfig.switches.isDaEnabled && installConfig.switches.isTaEnabled) {
		dockerInfo = `To utilize the agents, pull the latest Docker images and run them using the appropriate supplied environment files, (${helpers.configFiles.DA_ENV_VARS} & ${helpers.configFiles.TA_ENV_VARS}):`;
	} else if (installConfig.switches.isDaEnabled) {
		dockerInfo = `To utilize the discovery agent, pull the latest Docker image and run it using the supplied environment file, (${helpers.configFiles.DA_ENV_VARS}):`;
	} else {
		dockerInfo = `To utilize the traceability agent, pull the latest Docker image and run it using the supplied environment file, (${helpers.configFiles.TA_ENV_VARS}):`;
	}
	console.log(chalk.whiteBright(dockerInfo), '\n');

	if (installConfig.switches.isDaEnabled) {
		const daImageVersion = `${daImage}:${installConfig.daVersion}`;
		console.log(chalk.white('Pull the latest image of the Discovery Agent:'));
		console.log(chalk.cyan(`docker pull ${daImageVersion}`));
		console.log(chalk.white(isWindows ? startDaWinMsg : startDaLinuxMsg));
		console.log(chalk.cyan(isWindows ? runDaWinMsg : runDaLinuxMsg));
		console.log('\t', chalk.cyan(`-v /data ${daImageVersion}`));
	}
	if (installConfig.switches.isTaEnabled) {
		const taImageVersion = `${taImage}:${installConfig.taVersion}`;
		console.log(chalk.white('Pull the latest image of the Traceability Agent:'));
		console.log(chalk.cyan(`docker pull ${taImageVersion}`));
		console.log(chalk.white(isWindows ? startTaWinMsg : startTaLinuxMsg));
		console.log(chalk.cyan(isWindows ? runTaWinMsg : runTaLinuxMsg));
		console.log('\t', chalk.cyan(`-v ${eventLogPath} -v /data ${taImageVersion}`));
	}
};

const binarySuccessMsg = (isNewDosa: boolean, isDaEnabled: boolean, isTaEnabled: boolean) => {
	const daFiles = [ ConfigFiles.DAEnvVars, ConfigFiles.EdgeDABinaryFile, ConfigFiles.EdgeDAYaml ];
	const taFiles = [ ConfigFiles.TAEnvVars, ConfigFiles.EdgeTABinaryFile, ConfigFiles.EdgeTAYaml ];
	const keys = [ 'private_key.pem', 'public_key.pem' ];

	let files: string[] = [];
	if (isNewDosa) {
		files = files.concat(keys);
	}
	if (isDaEnabled) {
		files = files.concat(daFiles);
	}
	if (isTaEnabled) {
		files = files.concat(taFiles);
	}
	const agents = isDaEnabled && isTaEnabled ? 'agents' : 'agent';

	console.log(chalk.whiteBright('Please copy following files from current folder to API Gateway machine:'));
	console.log(chalk.cyan(files.join('\n')));
	console.log(chalk.whiteBright('for example'), chalk.cyan(`scp ${files.join(' ')} root@host:~/some_folder/`));

	console.log(chalk.whiteBright(`\nTo start the ${agents}:`));
	if (isDaEnabled) {
		console.log(chalk.cyan(`./discovery_agent --envFile ./${helpers.configFiles.DA_ENV_VARS}`));
	}
	if (isTaEnabled) {
		console.log(chalk.cyan(`./traceability_agent --envFile ./${helpers.configFiles.TA_ENV_VARS}`));
	}
};

const helmSuccessMsg = (namespace: string, isDaEnabled: boolean, isTaEnabled: boolean) => {
	const imagePullOverrides = '--set image.pullSecret=<image-pull-secret-name>';
	const agentHelmInfo = new Set<AgentHelmInfo>();
	if (isDaEnabled) {
		console.log(
			chalk.white(`Discovery Agent override file has been placed at ${process.cwd()}/${ConfigFiles.DAHelmOverride}`)
		);
		agentHelmInfo.add({
			helmReleaseName: 'v7-discovery',
			helmChartName: 'axway/v7-discovery',
			overrideFileName: ConfigFiles.DAHelmOverride,
			imageSecretOverrides: imagePullOverrides
		});
	}
	if (isTaEnabled) {
		console.log(
			chalk.white(`Traceability Agent override file has been placed at ${process.cwd()}/${ConfigFiles.TAHelmOverride}`)
		);
		agentHelmInfo.add({
			helmReleaseName: 'v7-traceability',
			helmChartName: 'axway/v7-traceability',
			overrideFileName: ConfigFiles.TAHelmOverride,
			imageSecretOverrides: imagePullOverrides
		});
	}

	helmImageSecretInfo(namespace);
	helmInstallInfo(
		'Edge',
		namespace,
		agentHelmInfo,
	);
};

const edgeAgentNameMap = {
	[AgentTypes.da]: AgentNames.EDGE_DA,
	[AgentTypes.ta]: AgentNames.EDGE_TA,
};

export const EdgeInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	InstallPreprocess: installPreprocess,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	AgentNameMap: edgeAgentNameMap,
	GatewayDisplay: GatewayTypes.EDGE_GATEWAY,
};

export const EdgeGWOnlyInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleTypeGWOnly,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	InstallPreprocess: installPreprocess,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	AgentNameMap: edgeAgentNameMap,
	GatewayDisplay: GatewayTypes.EDGE_GATEWAY,
};
function helmImageSecretInfo(namespace: string) {
	throw new Error('Function not implemented.');
}

function helmInstallInfo(arg0: string, namespace: string, agentHelmInfo: Set<AgentHelmInfo>) {
	throw new Error('Function not implemented.');
}

