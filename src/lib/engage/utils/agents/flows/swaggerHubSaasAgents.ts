import chalk from 'chalk';
import logger from '../../../../logger.js';
import { ApiServerClient } from '../../../clients-external/apiserverclient.js';
import { DefinitionsManager } from '../../../results/DefinitionsManager.js';
import { InstallationFlowMethods } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentResourceKind, AgentTypes, BundleType, CentralAgentConfig, GatewayTypeToDataPlane, GenericResource, SaaSGatewayTypes, YesNo, YesNoChoices } from '../../../types.js';
import { askInput, askList, InputValidation, validateRegex } from '../../basic-prompts.js';
import * as helpers from '../index.js';
import * as crypto from 'crypto';
import { DataplaneConfig } from './saasAgentsBase.js';

const debugLog = logger('central: install: agents: saas');

class SwaggerHubDataplaneConfig extends DataplaneConfig {
	owner: string;
	filter: SwaggerHubFilterConfig;

	constructor(owner: string, filter: SwaggerHubFilterConfig) {
		super('SwaggerHub');
		this.owner = owner;
		this.filter = filter;
	}
}

class SwaggerHubFilterConfig {
	visibility: SwaggerHubFilterVisibility;
	publication: SwaggerHubFilterPublication;

	constructor(visibility: SwaggerHubFilterVisibility, publication: SwaggerHubFilterPublication) {
		this.visibility = visibility;
		this.publication = publication;
	}
}

enum SwaggerHubFilterVisibility {
	Both = 'Both',
	Public = 'Public',
	Private = 'Private'
}

enum SwaggerHubFilterPublication {
	Both = 'Both',
	Published = 'Published',
	UnPublished = 'UnPublished'
}

class SaasAgentValues {
	frequencyDA: string;
	queueDA: boolean;
	frequencyTA: string;
	dataplaneConfig: DataplaneConfig;
	centralConfig: CentralAgentConfig;
	owner: string;
	visibility: SwaggerHubFilterVisibility;
	publication: SwaggerHubFilterPublication;

	constructor() {
		this.frequencyDA = '';
		this.queueDA = false;
		this.frequencyTA = '';
		this.dataplaneConfig = new DataplaneConfig();
		this.centralConfig = new CentralAgentConfig();
		this.owner = '';
		this.visibility = SwaggerHubFilterVisibility.Both;
		this.publication = SwaggerHubFilterPublication.Both;
	}
}

class SaasSwaggerHubAgentValues extends SaasAgentValues {
	apiKey: string;

	constructor() {
		super();
		this.apiKey = '';
	}

	getAccessData() {
		const data = JSON.stringify({
			apiKey: this.apiKey
		});

		return data;
	}
}

// SwaggerHub SaaSPrompts - all SwaggerHub Saas prompts to the user for input
const SaasPrompts = {
	API_KEY: 'Enter the SwaggerHub API Key the agent will use',
	ORGANIZATION_OWNER: 'Enter the SwaggerHub Organization Owner the agent will use',
	API_VISIBILITY: 'Enter the visibility of the APIs to be discovered (Optional).',
	API_PUBLICATION: 'Enter the publication status of APIs to be discovered (Optional).',
	DA_FREQUENCY: 'How often should the discovery run, leave blank for integrating in CI/CD process',
	QUEUE: 'Do you want to discover immediately after installation',
};

export const askBundleType = async (): Promise<BundleType> => {
	// SwaggerHub agent has only DA
	return BundleType.DISCOVERY;
};

const askConfigType = async (): Promise<AgentConfigTypes> => {
	return AgentConfigTypes.HOSTED;
};

const askForSwaggerHubCredentials = async (hostedAgentValues: SaasSwaggerHubAgentValues): Promise<SaasAgentValues> => {
	debugLog.log('gathering access details for SwaggerHub');

	hostedAgentValues.apiKey = (await askInput({
		msg: SaasPrompts.API_KEY,
		defaultValue: hostedAgentValues.apiKey !== '' ? hostedAgentValues.apiKey : undefined,
	})) as string;

	return hostedAgentValues;
};

const validateFrequency = (): InputValidation => (input: string | number) => {
	const val = validateRegex(
		helpers.frequencyRegex,
		helpers.invalidValueExampleErrMsg('frequency', '3d5h12m'),
	)(input);
	if (typeof val === 'string') {
		return val;
	}
	const r = input.toString().match(/^(\d*)m/);
	if (r) {
		// only minutes
		const mins = r[1];
		if (parseInt(mins as string, 10) < 30) {
			return 'Minimum frequency is 30m';
		}
	}
	return true;
};

const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<SaasAgentValues> => {
	installConfig.log('\nCONNECTION TO SwaggerHub API GATEWAY:');
	installConfig.log(
		chalk.gray('The Discovery Agent needs to connect to the SwaggerHub API Gateway to discover API\'s for publishing to Amplify Central')
	);

	// DeploymentType
	let hostedAgentValues: SaasAgentValues = new SaasAgentValues();

	if (installConfig.gatewayType === SaaSGatewayTypes.SWAGGERHUB) {
		// SwaggerHub connection details
		hostedAgentValues = new SaasSwaggerHubAgentValues();
		hostedAgentValues = await askForSwaggerHubCredentials(hostedAgentValues as SaasSwaggerHubAgentValues);
	}

	// Ask to queue discovery now
	debugLog.log('getting the frequency and if the agent should run now');
	installConfig.log(
		chalk.gray('\n00d00h00m format, where 30m = 30 minutes, 1h = 1 hour, 7d = 7 days, and 7d1h30m = 7 days 1 hour and 30 minutes. Minimum of 30m.')
	);
	hostedAgentValues.frequencyDA = await askInput({
		msg: SaasPrompts.DA_FREQUENCY,
		validate: validateFrequency(),
		allowEmptyInput: true,
	}) as string;

	hostedAgentValues.queueDA = await askList({
		msg: SaasPrompts.QUEUE,
		default: YesNo.No,
		choices: YesNoChoices,
	}) as YesNo === YesNo.Yes;

	// get swaggerhub organization owner
	hostedAgentValues.owner = (await askInput({
		msg: SaasPrompts.ORGANIZATION_OWNER,
		defaultValue: hostedAgentValues.owner !== '' ? hostedAgentValues.owner : undefined,
	})) as string;

	// get visility of APIs to be discovered
	hostedAgentValues.visibility = (await askList({
		msg: SaasPrompts.API_VISIBILITY,
		default: SwaggerHubFilterVisibility.Both,
		choices: [
			{ name: SwaggerHubFilterVisibility.Both, value: SwaggerHubFilterVisibility.Both },
			{ name: SwaggerHubFilterVisibility.Public, value: SwaggerHubFilterVisibility.Public },
			{ name: SwaggerHubFilterVisibility.Private, value: SwaggerHubFilterVisibility.Private },
		],
	})) as SwaggerHubFilterVisibility;

	// get publication status of APIs to be discovered
	hostedAgentValues.publication = (await askList({
		msg: SaasPrompts.API_PUBLICATION,
		default: SwaggerHubFilterPublication.Both,
		choices: [
			{ name: SwaggerHubFilterPublication.Both, value: SwaggerHubFilterPublication.Both },
			{ name: SwaggerHubFilterPublication.Published, value: SwaggerHubFilterPublication.Published },
			{ name: SwaggerHubFilterPublication.UnPublished, value: SwaggerHubFilterPublication.UnPublished },
		],
	})) as SwaggerHubFilterPublication;

	return hostedAgentValues;
};

const generateOutput = async (installConfig: AgentInstallConfig): Promise<string> => {
	return `Install complete of hosted agent for ${installConfig.gatewayType} region`;
};

const createEncryptedAccessData = async (hostedAgentValues: SaasSwaggerHubAgentValues, dataplaneRes: GenericResource): Promise<string> => {
	// grab key from data plane resource
	const key = dataplaneRes.security?.encryptionKey  || '';
	const hash = dataplaneRes.security?.encryptionHash || '';

	if (key === '' || hash === '') {
		throw Error('cannot encrypt access data as the encryption key info was incomplete');
	}
	const encData = crypto.publicEncrypt({
		key: key,
		padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
		oaepHash: hash,
	},
	Buffer.from(hostedAgentValues.getAccessData())
	);

	return encData.toString('base64');
};

const completeInstall = async (installConfig: AgentInstallConfig, apiServerClient?: ApiServerClient, defsManager?: DefinitionsManager): Promise<void> => {
	/**
	 * Create agent resources
	 */
	installConfig.log('\n');
	const swaggerHubAgentValues = installConfig.gatewayConfig as SaasSwaggerHubAgentValues;

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

	if (installConfig.gatewayType === SaaSGatewayTypes.SWAGGERHUB) {
		swaggerHubAgentValues.dataplaneConfig
			= new SwaggerHubDataplaneConfig((swaggerHubAgentValues as SaasSwaggerHubAgentValues).owner,
				new SwaggerHubFilterConfig((swaggerHubAgentValues as SaasSwaggerHubAgentValues).visibility, (swaggerHubAgentValues as SaasSwaggerHubAgentValues).publication));
	}

	// create the data plane resource
	const dataplaneRes = await helpers.createNewDataPlaneResource(
		apiServerClient as ApiServerClient,
		defsManager as DefinitionsManager,
		installConfig.centralConfig.environment,
		GatewayTypeToDataPlane[installConfig.gatewayType],
		swaggerHubAgentValues.dataplaneConfig,
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
			await createEncryptedAccessData(swaggerHubAgentValues, dataplaneRes),
			installConfig.log,
		);
	} catch (_error) {
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

	installConfig.centralConfig.daAgentName = await helpers.createNewAgentResource(
		apiServerClient as ApiServerClient,
		defsManager as DefinitionsManager,
		installConfig.centralConfig.environment,
		GatewayTypeToDataPlane[installConfig.gatewayType],
		AgentResourceKind.da,
		AgentTypes.da,
		installConfig.centralConfig.ampcTeamName,
		GatewayTypeToDataPlane[installConfig.gatewayType] + ' Discovery Agent',
		dataplaneRes.name,
		swaggerHubAgentValues.frequencyDA,
		swaggerHubAgentValues.queueDA,
		undefined,
		undefined,
		installConfig.log,
	);

	installConfig.log(await generateOutput(installConfig));
};

export const SwaggerHubSaaSInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: [],
	AgentNameMap: {
		[AgentTypes.da]: AgentNames.SWAGGERHUB_DA,
	},
	GatewayDisplay: SaaSGatewayTypes.SWAGGERHUB,
};
