import chalk from 'chalk';
import logger from '../../../../logger.js';
import { ApiServerClient } from '../../../clients-external/apiserverclient.js';
import { DefinitionsManager } from '../../../results/DefinitionsManager.js';
import { InstallationFlowMethods } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentResourceKind, AgentTypes, ApigeeMetricsFilterConfig, APIGEEXAuthType, APIGEEXDISCOVERYMODES, BundleType, CentralAgentConfig, GatewayTypeToDataPlane, GenericResource, SaaSGatewayTypes, YesNo, YesNoChoices } from '../../../types.js';
import { askInput, askList, InputValidation, validateRegex } from '../../basic-prompts.js';
import * as helpers from '../index.js';
import * as crypto from 'crypto';
import { DataplaneConfig } from './saasAgentsBase.js';

const debugLog = logger('engage: install: agents: saas');

class APIGEEXDataplaneConfig extends DataplaneConfig {
	projectId: string;
	developerEmail: string;
	mode: APIGEEXDISCOVERYMODES;
	metricsFilter: ApigeeMetricsFilterConfig;
	environment: string;

	constructor(projectID: string, developerEmail: string, mode: APIGEEXDISCOVERYMODES, metricsFilter: ApigeeMetricsFilterConfig, environment: string) {
		super('Apigee X');
		this.projectId = projectID;
		this.developerEmail = developerEmail;
		this.mode = mode;
		this.metricsFilter = metricsFilter;
		this.environment = environment;
	}
}

class SaasAgentValues {
	frequencyDA: string;
	queueDA: boolean;
	frequencyTA: string;
	dataplaneConfig: DataplaneConfig;
	centralConfig: CentralAgentConfig;

	constructor() {
		this.frequencyDA = '';
		this.queueDA = false;
		this.frequencyTA = '';
		this.dataplaneConfig = new DataplaneConfig();
		this.centralConfig = new CentralAgentConfig();
	}
}

class SaasAPIGEEXAgentValues extends SaasAgentValues {
	authType: APIGEEXAuthType;
	clientEmailAddress: string;
	credentialJSON: string;
	projectId: string;
	developerEmailAddress: string;
	mode: APIGEEXDISCOVERYMODES;
	metricsFilter: ApigeeMetricsFilterConfig;
	environment: string;

	constructor() {
		super();
		this.authType = APIGEEXAuthType.IMP_SVC_ACC;
		this.clientEmailAddress = '';
		this.credentialJSON = '';
		this.projectId = '';
		this.developerEmailAddress = '';
		this.mode = APIGEEXDISCOVERYMODES.PROXY;
		this.metricsFilter = new ApigeeMetricsFilterConfig(true, []);
		this.environment = '';
	}

	getAccessData() {
		let data = JSON.stringify({
			client_email: this.clientEmailAddress
		});

		if (this.authType === APIGEEXAuthType.ACCESS_CREDENTIAL) {
			data = JSON.stringify(this.credentialJSON);
		}

		return data;
	}
}

// APIGEEX SaaSPrompts - all APIGEEX Saas prompts to the user for input
const SaasPrompts = {
	AUTHENTICATION_TYPE: 'Authenticate with an Impersonation of a Service Account or by providing a Credential File',
	PROJECT_ID: 'Enter the APIGEE X Project ID the agent will use',
	DEVELOPER_EMAIL_ADDRESS: 'Enter the APIGEE X Developer Email Address the agent will use',
	CLIENT_EMAIL_ADDRESS: 'Enter the Client Email Address the agent will use for the APIGEE X Service Account',
	UPLOAD_CREDENTIAL_FILE: 'Upload a JSON Credential file to be used for APIGEE X Authentication',
	DA_FREQUENCY: 'How often should the discovery run, leave blank for integrating in CI/CD process',
	TA_FREQUENCY: 'How often should the traffic collection run, leave blank for manual trigger only',
	QUEUE: 'Do you want to discover immediately after installation',
	ENTER_MORE: 'Do you want to enter another {0} for {1}',
	FILTER_METRICS: 'Do you want metrics filtering? (defaults to true)',
	FILTERED_APIS: 'Enter APIs to filter metrics for',
	ENTER_MORE_APIS: 'Do you want to add another API?',
	ENVIRONMENT: 'Enter the Apigee Environment to filter discovered APIs/metrics',
};

export const askBundleType = async (): Promise<BundleType> => {
	return (await askList({
		msg: helpers.agentMessages.selectAgentType,
		choices: [ BundleType.ALL_AGENTS, BundleType.DISCOVERY ],
	})) as BundleType;
};

const askConfigType = async (): Promise<AgentConfigTypes> => {
	return AgentConfigTypes.HOSTED;
};

const askForAPIGEEXCredentials = async (hostedAgentValues: SaasAPIGEEXAgentValues, log: (text: string) => void = () => {}): Promise<SaasAgentValues> => {
	debugLog.log('gathering access details for apigee x');

	hostedAgentValues.projectId = (await askInput({
		msg: SaasPrompts.PROJECT_ID,
		defaultValue: hostedAgentValues.projectId !== '' ? hostedAgentValues.projectId : undefined,
		validate: validateRegex(
			helpers.APIGEEXRegexPatterns.APIGEEX_REGEXP_PROJECT_ID,
			helpers.invalidValueExampleErrMsg('Project ID', 'rd-amplify-apigee-x')
		),
	})) as string;

	// get developer email address
	hostedAgentValues.developerEmailAddress = (await askInput({
		msg: SaasPrompts.DEVELOPER_EMAIL_ADDRESS,
		defaultValue: hostedAgentValues.developerEmailAddress !== '' ? hostedAgentValues.developerEmailAddress : undefined,
		allowEmptyInput: true,
	})) as string;

	hostedAgentValues.authType = APIGEEXAuthType.IMP_SVC_ACC;

	log(
		chalk.gray('Please refer to docs.axway.com for information on creating the necessary APIGEE X IAM policies')
	);

	if (hostedAgentValues.authType === APIGEEXAuthType.IMP_SVC_ACC) {
		debugLog.log('using impersonate service account authentication');
		// get client email address
		hostedAgentValues.clientEmailAddress = (await askInput({
			msg: SaasPrompts.CLIENT_EMAIL_ADDRESS,
			defaultValue: hostedAgentValues.clientEmailAddress !== '' ? hostedAgentValues.clientEmailAddress : undefined,
			allowEmptyInput: true,
		})) as string;
	}

	hostedAgentValues.metricsFilter.filterMetrics = await askList({
		msg: SaasPrompts.FILTER_METRICS,
		default: YesNo.No,
		choices: YesNoChoices,
	}) as YesNo === YesNo.Yes;

	if (hostedAgentValues.metricsFilter.filterMetrics) {
		let askFilteredAPIs = true;
		log(chalk.gray('An array of APIs to filter metrics for'));
		while (askFilteredAPIs) {
			const api = (await askInput({
				msg: SaasPrompts.FILTERED_APIS,
				allowEmptyInput: true,
			})) as string;

			hostedAgentValues.metricsFilter.filteredAPIs.push(api);

			askFilteredAPIs = await askList({
				msg: SaasPrompts.ENTER_MORE_APIS,
				default: YesNo.No,
				choices: YesNoChoices,
			}) === YesNo.Yes;
		}
	}

	hostedAgentValues.environment = (await askInput({
		msg: SaasPrompts.ENVIRONMENT,
		defaultValue: '',
		allowEmptyInput: true,
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
	installConfig.log('\nCONNECTION TO APIGEE X API GATEWAY:');
	installConfig.log(
		chalk.gray('The Discovery Agent needs to connect to the APIGEE X API Gateway to discover API\'s for publishing to Amplify Engage')
	);

	// DeploymentType
	let hostedAgentValues: SaasAgentValues = new SaasAgentValues();

	if (installConfig.gatewayType === SaaSGatewayTypes.APIGEEX_GATEWAY) {
		// APIGEE X connection details
		hostedAgentValues = new SaasAPIGEEXAgentValues();
		hostedAgentValues = await askForAPIGEEXCredentials(hostedAgentValues as SaasAPIGEEXAgentValues, installConfig.log);
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

	if (installConfig.switches.isTaEnabled) {
		installConfig.log(
			chalk.gray('\n00d00h00m format, where 30m = 30 minutes, 1h = 1 hour, 7d = 7 days, and 7d1h30m = 7 days 1 hour and 30 minutes. Minimum of 30m.')
		);
		hostedAgentValues.frequencyTA = await askInput({
			msg: SaasPrompts.TA_FREQUENCY,
			defaultValue: '30m',
			validate: validateFrequency(),
			allowEmptyInput: true,
		}) as string;
	}

	return hostedAgentValues;
};

const generateOutput = async (installConfig: AgentInstallConfig): Promise<string> => {
	return `Install complete of hosted agent for ${installConfig.gatewayType} region`;
};

const createEncryptedAccessData = async (hostedAgentValues: SaasAPIGEEXAgentValues, dataplaneRes: GenericResource): Promise<string> => {
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
	const apigeeXAgentValues = installConfig.gatewayConfig as SaasAPIGEEXAgentValues;

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

	if (installConfig.gatewayType === SaaSGatewayTypes.APIGEEX_GATEWAY) {
		apigeeXAgentValues.dataplaneConfig
			= new APIGEEXDataplaneConfig((apigeeXAgentValues as SaasAPIGEEXAgentValues).projectId,
				(apigeeXAgentValues as SaasAPIGEEXAgentValues).developerEmailAddress, (apigeeXAgentValues as SaasAPIGEEXAgentValues).mode,
				(apigeeXAgentValues as SaasAPIGEEXAgentValues).metricsFilter, (apigeeXAgentValues as SaasAPIGEEXAgentValues).environment);
	}

	// create the data plane resource
	const dataplaneRes = await helpers.createNewDataPlaneResource(
		apiServerClient as ApiServerClient,
		defsManager as DefinitionsManager,
		installConfig.centralConfig.environment,
		GatewayTypeToDataPlane[installConfig.gatewayType],
		apigeeXAgentValues.dataplaneConfig,
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
			await createEncryptedAccessData(apigeeXAgentValues, dataplaneRes),
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
		apigeeXAgentValues.frequencyDA,
		apigeeXAgentValues.queueDA,
		undefined,
		undefined,
		installConfig.log,
	);

	if (installConfig.switches.isTaEnabled) {
		// create traceability agent resource
		installConfig.centralConfig.taAgentName = await helpers.createNewAgentResource(
			apiServerClient as ApiServerClient,
			defsManager as DefinitionsManager,
			installConfig.centralConfig.environment,
			GatewayTypeToDataPlane[installConfig.gatewayType],
			AgentResourceKind.ta,
			AgentTypes.ta,
			installConfig.centralConfig.ampcTeamName,
			GatewayTypeToDataPlane[installConfig.gatewayType] + ' Traceability Agent',
			dataplaneRes.name,
			apigeeXAgentValues.frequencyTA,
			false, // APIGEE X TA is never triggered at install, as DA has to run prior
			undefined,
			undefined,
			installConfig.log,
		);
	}

	installConfig.log(await generateOutput(installConfig));
};

export const APIGEEXSaaSInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: [],
	AgentNameMap: {
		[AgentTypes.da]: AgentNames.APIGEEX_DA,
		[AgentTypes.ta]: AgentNames.APIGEEX_TA,
	},
	GatewayDisplay: SaaSGatewayTypes.APIGEEX_GATEWAY,
};
