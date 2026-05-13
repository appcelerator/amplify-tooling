import chalk from 'chalk';
import logger from '../../../../logger.js';
import { ApiServerClient } from '../../../clients-external/apiserverclient.js';
import { DefinitionsManager } from '../../../results/DefinitionsManager.js';
import { InstallationFlowMethods } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentResourceKind, AgentTypes, BundleType, CentralAgentConfig, GatewayTypes, GatewayTypeToDataPlane, GenericResource, SaaSGatewayTypes, YesNo, YesNoChoices } from '../../../types.js';
import { askInput, askList, validateRegex, validateValueRange } from '../../basic-prompts.js';
import * as helpers from '../index.js';
import * as crypto from 'crypto';
import { DataplaneConfig } from './saasAgentsBase.js';

const { log } = logger('engage: install: agents: Akamai');

class AkamaiDataplaneConfig extends DataplaneConfig {
	baseUrl: string;
	segmentLength: number;
	environments: AkamaiGroups[];
	constructor(baseUrl: string, segmentLength: number, groups: AkamaiGroups[]) {
		super('Akamai');
		this.baseUrl = baseUrl;
		this.segmentLength = segmentLength;
		this.environments = groups;
	}
}

class AkamaiGroups {
	akamai: string;
	environment: string;

	constructor(akamai: string, environment: string) {
		this.akamai = akamai;
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

class SaasAkamaiAgentValues extends SaasAgentValues {
	baseUrl: string;
	clientId: string;
	clientSecret: string;
	segmentLength: number;
	environments: string[];
	centralEnvironments: string[];

	constructor() {
		super();
		this.baseUrl = '';
		this.clientId = '';
		this.clientSecret = '';
		this.segmentLength = 1;
		this.environments = [];
		this.centralEnvironments = [];
	}

	override getAccessData() {
		const data = JSON.stringify({
			clientID: this.clientId,
			clientSecret: this.clientSecret,
		});

		return data;
	}
}

// AkamaiSaaSPrompts - all Akamai Saas prompts to the user for input
const SaasPrompts = {
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

const askConfigType = async (): Promise<AgentConfigTypes> => {
	return AgentConfigTypes.HOSTED;
};

const askEnvironments = async (centralEnvs: GenericResource[], hostedAgentValues: SaasAkamaiAgentValues, excludeEnvironment?: string): Promise<void> => {
	// Filter out the already-selected agent installation environment
	if (excludeEnvironment) {
		centralEnvs = centralEnvs.filter(env => env.name !== excludeEnvironment);
	}

	let askEnvs = true;
	const envs = [];
	const mappedCentralEnvs = [];
	console.log(chalk.gray(SaasPrompts.environmentsDescription));
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
// Questions for the configuration of Akamai agents
//
const askAkamaiBaseUrl = async (): Promise<string> =>
	(await askInput({
		msg: SaasPrompts.enterBaseUrl,
		validate: validateRegex(
			helpers.AkamaiRegexPatterns.baseURLRegex,
			helpers.invalidValueExampleErrMsg('baseURL', 'https://akamai.com'),
		),
	})) as string;

const askAkamaiClientId = async (): Promise<string> =>
	(await askInput({
		msg: SaasPrompts.enterClientId,
	})) as string;

const askAkamaiClientSecret = async (): Promise<string> =>
	(await askInput({
		msg: SaasPrompts.enterClientSecret,
	})) as string;

const askAkamaiSegmentLength = async (): Promise<number> =>
	(await askInput({
		msg: SaasPrompts.enterSegmentLength,
		type: 'number',
		validate: validateValueRange(0),
	})) as number;

const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<SaasAgentValues> => {
	console.log('\nCONNECTION TO AKAMAI API GATEWAY:');
	// DeploymentType
	let hostedAgentValues: SaasAkamaiAgentValues = new SaasAkamaiAgentValues();

	if (installConfig.gatewayType === SaaSGatewayTypes.AKAMAI) {
		log('gathering access details for akamai');

		// Akamai connection details
		hostedAgentValues = new SaasAkamaiAgentValues();
		hostedAgentValues.baseUrl = await askAkamaiBaseUrl();
		hostedAgentValues.clientId = await askAkamaiClientId();
		hostedAgentValues.clientSecret = await askAkamaiClientSecret();
		hostedAgentValues.segmentLength = await askAkamaiSegmentLength();

		const centralEnvs = await helpers.getCentralEnvironments(installConfig.centralConfig.apiServerClient as ApiServerClient, installConfig.centralConfig.definitionManager as DefinitionsManager);
		// Pass the already-selected agent installation environment to exclude it from mapping choices
		const agentInstallEnv = installConfig.centralConfig.ampcEnvInfo?.name;
		await askEnvironments(centralEnvs!, hostedAgentValues, agentInstallEnv);
	}

	return hostedAgentValues;
};

const generateOutput = async (installConfig: AgentInstallConfig): Promise<string> => {
	return `Install complete of hosted agent for ${installConfig.gatewayType} region`;
};

const createEncryptedAccessData = async (hostedAgentValues: SaasAkamaiAgentValues, dataplaneRes: GenericResource): Promise<string> => {
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
	console.log('\n');
	const akamaiAgentValues = installConfig.gatewayConfig as SaasAkamaiAgentValues;

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
			}
		)
		: installConfig.centralConfig.ampcEnvInfo.name;

	if (installConfig.gatewayType === GatewayTypes.AKAMAI) {
		const akamaiGroupObjs = (akamaiAgentValues.environments || []).map((env, idx) =>
			new AkamaiGroups(env, akamaiAgentValues.centralEnvironments[idx])
		);
		akamaiAgentValues.dataplaneConfig = new AkamaiDataplaneConfig(
			akamaiAgentValues.baseUrl,
			akamaiAgentValues.segmentLength,
			akamaiGroupObjs
		);
	}

	// create the data plane resource
	const dataplaneRes = await helpers.createNewDataPlaneResource(
		apiServerClient as ApiServerClient,
		defsManager as DefinitionsManager,
		installConfig.centralConfig.environment,
		GatewayTypeToDataPlane[installConfig.gatewayType],
		akamaiAgentValues.dataplaneConfig,
	);
	// create data plane secret resource
	try {
		await helpers.createNewDataPlaneSecretResource(
			apiServerClient as ApiServerClient,
			defsManager as DefinitionsManager,
			installConfig.centralConfig.environment,
			GatewayTypeToDataPlane[installConfig.gatewayType],
			dataplaneRes.name,
			await createEncryptedAccessData(akamaiAgentValues, dataplaneRes),
		);
	} catch (error) {
		log(error);
		console.log(
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

	// create compliance agent resource
	installConfig.centralConfig.taAgentName = await helpers.createNewAgentResource(
		apiServerClient as ApiServerClient,
		defsManager as DefinitionsManager,
		installConfig.centralConfig.environment,
		GatewayTypeToDataPlane[installConfig.gatewayType],
		AgentResourceKind.ca,
		AgentTypes.ca,
		installConfig.centralConfig.ampcTeamName,
		GatewayTypeToDataPlane[installConfig.gatewayType] + ' Compliance Agent',
		dataplaneRes.name
	);

	console.log(await generateOutput(installConfig));
};

export const AkamaiSaaSInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: [],
	AgentNameMap: {
		[AgentTypes.ca]: AgentNames.AKAMAI_CA,
	},
	GatewayDisplay: GatewayTypes.AKAMAI,
};
