import chalk from 'chalk';
import logger from '../../../../logger.js';
import { ApiServerClient } from '../../../clients-external/apiserverclient.js';
import { DefinitionsManager } from '../../../results/DefinitionsManager.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentResourceKind, AgentTypes, BundleType, CentralAgentConfig, GatewayTypes, GatewayTypeToDataPlane, GenericResource, InstallationFlowMethods, SaaSGatewayTypes, TraceableRegionType, YesNo, YesNoChoices } from '../../../types.js';
import { askInput, askList } from '../../basic-prompts.js';
import * as helpers from '../index.js';
import * as crypto from 'crypto';
import { DataplaneConfig } from './saasAgentsBase.js';

const { log, error } = logger('engage: install: agents: Traceable');

class TraceableDataplaneConfig extends DataplaneConfig {
	region: string;
	environments: TraceableEnvironments[];
	constructor(region: string, environments: TraceableEnvironments[]) {
		super('Traceable');
		this.region = region;
		this.environments = environments;
	}
}

class TraceableEnvironments {
	traceable: string;
	environment: string;

	constructor(traceable: string, environment: string) {
		this.traceable = traceable;
		this.environment = environment;
	}
}

class SaasAgentValues {
	dataplaneConfig: DataplaneConfig;
	centralConfig: CentralAgentConfig;

	constructor() {
		this.dataplaneConfig = new DataplaneConfig();
		this.centralConfig = new CentralAgentConfig();
	}

	getAccessData() {
		return '';
	}
}

class SaasTraceableAgentValues extends SaasAgentValues {
	traceableToken: string;
	traceableRegion: TraceableRegionType;
	environments: string[];
	centralEnvironments: string[];

	constructor() {
		super();
		this.traceableToken = '';
		this.traceableRegion = TraceableRegionType.US;
		this.environments = [];
		this.centralEnvironments = [];

	}

	override getAccessData() {
		const data = JSON.stringify({
			token: this.traceableToken,
		});

		return data;
	}
}

// TraceableSaaSPrompts - all Traceable Saas prompts to the user for input
const SaasPrompts = {
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

const askConfigType = async (): Promise<AgentConfigTypes> => {
	return AgentConfigTypes.HOSTED;
};

const askEnvironments = async (centralEnvs: GenericResource[], hostedAgentValues: SaasTraceableAgentValues, excludeEnvironment?: string, log: (text: string) => void = () => {}): Promise<void> => {
	// Filter out the already-selected agent installation environment
	if (excludeEnvironment) {
		centralEnvs = centralEnvs.filter(env => env.name !== excludeEnvironment);
	}

	let askEnvs = true;
	const envs = [];
	const mappedCentralEnvs = [];
	log(chalk.gray(SaasPrompts.environmentsDescription));
	while (askEnvs) {
		const env = (await askInput({
			msg: SaasPrompts.enterEnvironments,
			allowEmptyInput: true,
		})) as string;

		if (envs.length === 0 && (!env || env.toString().trim() === '')) {
			break;
		}

		if (env && env.toString().trim() !== '') {
			envs.push(env);
		}
		const centralMappingEnv = await askList({
			msg: SaasPrompts.selectCentralMappingEnvironment,
			choices: centralEnvs.map((e) => e.name),
		});

		if (centralMappingEnv && centralMappingEnv.toString().trim() !== '') {
			mappedCentralEnvs.push(centralMappingEnv);
		}
		centralEnvs = centralEnvs.filter(env => env.name !== centralMappingEnv);

		// Only ask if they want to continue if there are still environments available to map
		if (centralEnvs.length > 0) {
			askEnvs = await askList({
				msg: SaasPrompts.enterMoreEnvironments,
				default: YesNo.No,
				choices: YesNoChoices,
			}) === YesNo.Yes;
		} else {
			askEnvs = false;
		}
	}
	hostedAgentValues.environments = envs;
	hostedAgentValues.centralEnvironments = mappedCentralEnvs;
};

//
// Questions for the configuration of Traceable agent
//
const askToken = async (): Promise<string> =>
	(await askInput({
		msg: SaasPrompts.enterToken,
		allowEmptyInput: false,
	})) as string;

export const askTraceableRegion = async (): Promise<TraceableRegionType> => {
	return (await askList({
		msg: SaasPrompts.enterRegion,
		choices: Object.entries(TraceableRegionType).reduce((accumulator, curr) => {
			return accumulator.concat({
				name: curr[0],
				value: curr[1] as string,
			});
		}, [] as { name: string; value: string }[]),
		default: TraceableRegionType.US,
	})) as TraceableRegionType;
};

const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<SaasAgentValues> => {
	installConfig.log('\nCONNECTION TO TRACEABLE API GATEWAY:');
	// DeploymentType
	let hostedAgentValues: SaasTraceableAgentValues = new SaasTraceableAgentValues();

	if (installConfig.gatewayType === SaaSGatewayTypes.TRACEABLE) {
		log('gathering access details for traceable');

		// Traceable connection details
		hostedAgentValues = new SaasTraceableAgentValues();
		hostedAgentValues.traceableToken = await askToken();
		hostedAgentValues.traceableRegion = await askTraceableRegion();

		const centralEnvs = await helpers.getCentralEnvironments(installConfig.centralConfig.apiServerClient as ApiServerClient, installConfig.centralConfig.definitionManager as DefinitionsManager);
		// Pass the already-selected agent installation environment to exclude it from mapping choices
		const agentInstallEnv = installConfig.centralConfig.ampcEnvInfo?.name;
		await askEnvironments(centralEnvs!, hostedAgentValues, agentInstallEnv, installConfig.log);
	}

	return hostedAgentValues;
};

const generateOutput = async (installConfig: AgentInstallConfig): Promise<string> => {
	return `Install complete of hosted agent for ${installConfig.gatewayType} region`;
};

const createEncryptedAccessData = async (hostedAgentValues: SaasTraceableAgentValues, dataplaneRes: GenericResource): Promise<string> => {
	// grab key from data plane resource
	const key = dataplaneRes.security?.encryptionKey  || '';
	const hash = dataplaneRes.security?.encryptionHash || '';

	if (key === '' || hash === '') {
		throw Error('cannot encrypt access data as the encryption key info was incomplete');
	}

	const accessData = hostedAgentValues.getAccessData();

	const encData = crypto.publicEncrypt({
		key: key,
		padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
		oaepHash: hash,
	},
	new Uint8Array(Buffer.from(accessData, 'utf8'))
	);

	return encData.toString('base64');
};

const completeInstall = async (installConfig: AgentInstallConfig, apiServerClient?: ApiServerClient, defsManager?: DefinitionsManager): Promise<void> => {
	/**
     * Create agent resources
     */
	installConfig.log('\n');
	const traceableAgentValues = installConfig.gatewayConfig as SaasTraceableAgentValues;

	// create the environment, if necessary
	installConfig.centralConfig.environment = installConfig.centralConfig.ampcEnvInfo.isNew
		? await helpers.createByResourceType(
			apiServerClient as ApiServerClient,
			defsManager as DefinitionsManager,
			installConfig.centralConfig.ampcEnvInfo.name,
			'Environment',
			'env',
			{
				axwayManaged: installConfig.centralConfig.axwayManaged,
				production: installConfig.centralConfig.production,
			},
			undefined,
			undefined,
			installConfig.log,
		)
		: installConfig.centralConfig.ampcEnvInfo.name;

	if (installConfig.gatewayType === GatewayTypes.TRACEABLE) {
		const traceableEnvObjs = (traceableAgentValues.environments || []).map((env, idx) =>
			new TraceableEnvironments(env, traceableAgentValues.centralEnvironments[idx])
		);
		traceableAgentValues.dataplaneConfig = new TraceableDataplaneConfig(
			traceableAgentValues.traceableRegion,
			traceableEnvObjs
		);
	}

	// create the data plane resource
	const dataplaneRes = await helpers.createNewDataPlaneResource(
		apiServerClient as ApiServerClient,
		defsManager as DefinitionsManager,
		installConfig.centralConfig.environment,
		GatewayTypeToDataPlane[installConfig.gatewayType],
		traceableAgentValues.dataplaneConfig,
		installConfig.log,
	);
	// create data plane secret resource
	try {
		await helpers.createNewDataPlaneSecretResource(
			apiServerClient as ApiServerClient,
			defsManager as DefinitionsManager,
			installConfig.centralConfig.environment,
			GatewayTypeToDataPlane[installConfig.gatewayType],
			dataplaneRes.name,
			await createEncryptedAccessData(traceableAgentValues, dataplaneRes),
			installConfig.log,
		);
	} catch (err) {
		error(err);
		installConfig.log(
			chalk.redBright('rolling back installation. Please check the credential data before re-running install')
		);

		if (installConfig.centralConfig.ampcEnvInfo.isNew) {
			await helpers.deleteByResourceType(
				apiServerClient as ApiServerClient,
				defsManager as DefinitionsManager,
				installConfig.centralConfig.ampcEnvInfo.name,
				'Environment',
				'env',
			);
		} else {
			await helpers.deleteByResourceType(
				apiServerClient as ApiServerClient,
				defsManager as DefinitionsManager,
				dataplaneRes.name,
				'Dataplane',
				'dp',
				installConfig.centralConfig.environment,
			);
		}
		return;
	}

	installConfig.centralConfig.taAgentName = await helpers.createNewAgentResource(
		apiServerClient as ApiServerClient,
		defsManager as DefinitionsManager,
		installConfig.centralConfig.environment,
		GatewayTypeToDataPlane[installConfig.gatewayType],
		AgentResourceKind.ca,
		AgentTypes.ca,
		installConfig.centralConfig.ampcTeamName,
		GatewayTypeToDataPlane[installConfig.gatewayType] + ' Compliance Agent',
		dataplaneRes.name,
		undefined,
		undefined,
		undefined,
		undefined,
		installConfig.log,
	);

	installConfig.log(await generateOutput(installConfig));
};

export const TraceableSaaSInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: [],
	AgentNameMap: {
		[AgentTypes.ca]: AgentNames.TRACEABLE_CA,
	},
	GatewayDisplay: GatewayTypes.TRACEABLE,
};
