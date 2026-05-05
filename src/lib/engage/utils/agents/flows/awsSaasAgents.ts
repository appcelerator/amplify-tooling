import chalk from 'chalk';
import logger from '../../../../logger.js';
import { ApiServerClient } from '../../../clients-external/apiserverclient.js';
import { DefinitionsManager } from '../../../results/DefinitionsManager.js';
import { InstallationFlowMethods, validateFrequency } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentResourceKind, AgentTypes, BundleType, CentralAgentConfig, GatewayTypes, GatewayTypeToDataPlane, GenericResource, IDPAuthConfiguration, SaaSGatewayTypes, YesNo, YesNoChoices } from '../../../types.js';
import { askInput, askList, validateInputLength, validateRegex, validateValidRegex } from '../../basic-prompts.js';
import crypto from 'crypto';
import * as helpers from '../index.js';
import { FormatString } from '../../utils.js';

const { log } = logger('lib: engage: utils: agents: flows: awsSaasAgents');
const STAGE_TAG_NAME_LENGTH = 127;

class DataplaneConfig {
	type: string;

	constructor(type?: string) {
		this.type = type || '';
	}
}

class AWSDataplaneConfig extends DataplaneConfig {
	accessLogARN: string;
	fullTransactionLogging: boolean;
	stageTagName: string;

	constructor(arn: string, enableFullTransactionLogging: boolean, stageTagName: string) {
		super('AWS');
		this.accessLogARN = arn;
		this.fullTransactionLogging = enableFullTransactionLogging;
		this.stageTagName = stageTagName;
	}
}

class Sanitize {
	keyMatch: string;
	valueMatch: string;

	constructor(k: string, m: string) {
		this.keyMatch = k;
		this.valueMatch = m;
	}
}

class RedactionSet {
	show: string[];
	sanitize: Sanitize[];

	constructor() {
		this.show = [];
		this.sanitize = [];
	}
}

class Redaction {
	maskingCharacter: string;
	path: string[];
	queryArgument: RedactionSet;
	requestHeaders: RedactionSet;
	responseHeaders: RedactionSet;

	constructor() {
		this.maskingCharacter = '{*}';
		this.path = [];
		this.queryArgument = new RedactionSet();
		this.requestHeaders = new RedactionSet();
		this.responseHeaders = new RedactionSet();
	}
}

class SaasAgentValues {
	frequencyDA: string;
	queueDA: boolean;
	filterDA: string;
	frequencyTA: string;
	redaction: Redaction;
	dataplaneConfig: DataplaneConfig;
	centralConfig: CentralAgentConfig;

	constructor() {
		this.frequencyDA = '';
		this.queueDA = false;
		this.frequencyTA = '';
		this.filterDA = '';
		this.redaction = new Redaction();
		this.dataplaneConfig = new DataplaneConfig();
		this.centralConfig = new CentralAgentConfig();
	}

	getAccessData() {
		return '';
	}
}

class SaasAWSAgentValues extends SaasAgentValues {
	authType: AWSAuthType;
	accessKey: string;
	secretKey: string;
	region: string;
	assumeRole: string;
	externalID: string;
	accessLogARN: string;
	fullTransactionLogging: boolean;
	stageTagName: string;

	constructor() {
		super();
		this.authType = AWSAuthType.ASSUME;
		this.accessKey = '';
		this.secretKey = '';
		this.region = '';
		this.assumeRole = '';
		this.externalID = '';
		this.accessLogARN = '';
		this.fullTransactionLogging = false;
		this.stageTagName = '';
	}

	override getAccessData() {
		let data = JSON.stringify({
			region: this.region,
			roleARN: this.assumeRole,
			externalID: this.externalID,
		});

		if (this.authType === AWSAuthType.KEYS) {
			data = JSON.stringify({
				region: this.region,
				accessKeyID: this.accessKey,
				secretAccessKey: this.secretKey,
			});
		}

		return data;
	}
}

// ConfigFiles - all the config file that are used in the setup
const ConfigFiles = {};

// AWSAuthType - how the agent will authenticate to AWS
enum AWSAuthType {
	ASSUME = 'Assume Role Policy',
	KEYS = 'Access and Secret Keys',
}

// AWSSaaSPrompts - all AWS Saas prompts to the user for input
const SaasPrompts = {
	AUTHENTICATION_TYPE: 'Authenticate with an AssumeRole Policy or an Access Key ID and Secret Access Key',
	ACCESS_KEY: 'Enter the AWS Access Key ID the agent will use',
	SECRET_KEY: 'Enter the AWS Secret Access Key the agent will use',
	ASSUME_ROLE: 'Enter the Role ARN that the agent will Assume',
	EXTERNAL_ID: 'Enter the External ID the Assume Role expects',
	ACCESS_LOG_ARN: 'Enter the ARN for the Access Log that the Discovery will add and the Traceability will use',
	STAGE_TAG_NAME: 'Enter the name of the tag on AWS API Gateway Stage that holds mapped stage on Amplify Engage',
	FULL_TRANSACTION_LOGGING: 'Do you want to enable Full Transaction Logging? Please note that CloudWatch costs would increase when Full Transaction Logging is enabled',
	DA_FREQUENCY: 'How often should the discovery run, leave blank for integrating in CI/CD process',
	DA_FILTER: 'Please enter the filter conditions for discovery of API Services based on tags',
	TA_FREQUENCY: 'How often should the traffic collection run, leave blank for manual trigger only',
	QUEUE: 'Do you want to discover immediately after installation',
	REDACT_SHOW: 'Enter a regular expression for {0}s that may be shown',
	ENTER_SANITIZE_RULE: 'Do you want to add sanitization rules for {0}s',
	SANITIZE_KEY: 'Enter a regular expression for {0} keys that values should be sanitized',
	SANITIZE_VAL: 'Enter a regular expression for sanitization of values when matching a {0} key',
	MASKING_CHARS: 'Enter the characters to use when sanitizing a value',
	ENTER_MORE: 'Do you want to enter another {0} for {1}',
};

export const askBundleType = async (): Promise<BundleType> => {
	return (await askList({
		msg: 'Select the type of agent(s) you want to install',
		choices: [ BundleType.ALL_AGENTS, BundleType.DISCOVERY, BundleType.TRACEABILITY ],
	})) as BundleType;
};

export const askConfigType = async (): Promise<AgentConfigTypes> => {
	return AgentConfigTypes.HOSTED;
};

//
// Complex prompts
//
const askForRedactionSet = async (setting: string, redactionSet: RedactionSet): Promise<RedactionSet> => {
	// ask for path reg exs
	let askShow = true;
	console.log(chalk.gray(FormatString('\nRedaction settings for {0}s', setting)));
	while (askShow) {
		const input = (await askInput({
			msg: FormatString(SaasPrompts.REDACT_SHOW, setting),
			defaultValue: '.*',
			validate: validateValidRegex(),
		})) as string;
		redactionSet.show.push(input);

		askShow
			= (await askList({
				msg: FormatString(SaasPrompts.ENTER_MORE, 'redaction regular expression', setting),
				default: YesNo.No,
				choices: YesNoChoices,
			})) === YesNo.Yes;
	}

	console.log(chalk.gray(FormatString('Sanitization settings for {0}s', setting)));
	let askSanitize
		= (await askList({
			msg: FormatString(SaasPrompts.ENTER_SANITIZE_RULE, setting),
			default: YesNo.No,
			choices: YesNoChoices,
		})) === YesNo.Yes;
	console.log(
		chalk.gray(
			'When a match for the key regular expression is found, a match\nfor the value regular expression will be replaced by the masking character(s)'
		)
	);
	while (askSanitize) {
		const keyMatch = (await askInput({
			msg: FormatString(SaasPrompts.SANITIZE_KEY, setting),
			allowEmptyInput: true,
			validate: validateValidRegex(),
		})) as string;
		const valMatch = (await askInput({
			msg: FormatString(SaasPrompts.SANITIZE_VAL, setting),
			allowEmptyInput: true,
			validate: validateValidRegex(),
		})) as string;

		if (keyMatch === '' || valMatch === '') {
			console.log('can\'t add sanitization rule with an empty key or value regular expression');
		} else {
			redactionSet.sanitize.push(new Sanitize(keyMatch, valMatch));
		}

		askSanitize
			= (await askList({
				msg: FormatString(SaasPrompts.ENTER_MORE, 'sanitization rule', setting),
				default: YesNo.No,
				choices: YesNoChoices,
			})) === YesNo.Yes;
	}

	return redactionSet;
};

const askForRedaction = async (hostedAgentValues: SaasAgentValues): Promise<SaasAgentValues> => {
	console.log(chalk.gray('\nRedaction and Sanitization settings'));
	// ask for path reg exps
	let askPaths = true;
	console.log(chalk.gray('\nRedaction settings for URL paths'));
	while (askPaths) {
		const input = (await askInput({
			msg: FormatString(SaasPrompts.REDACT_SHOW, 'URL path'),
			defaultValue: '.*',
			validate: validateValidRegex(),
		})) as string;
		hostedAgentValues.redaction.path.push(input);

		askPaths
			= (await askList({
				msg: FormatString(SaasPrompts.ENTER_MORE, 'redaction regular expression', 'URL path'),
				default: YesNo.No,
				choices: YesNoChoices,
			})) === YesNo.Yes;
	}

	hostedAgentValues.redaction.queryArgument = await askForRedactionSet(
		'query argument',
		hostedAgentValues.redaction.queryArgument
	);
	hostedAgentValues.redaction.requestHeaders = await askForRedactionSet(
		'request header',
		hostedAgentValues.redaction.requestHeaders
	);
	hostedAgentValues.redaction.responseHeaders = await askForRedactionSet(
		'response header',
		hostedAgentValues.redaction.responseHeaders
	);

	hostedAgentValues.redaction.maskingCharacter = (await askInput({
		msg: SaasPrompts.MASKING_CHARS,
		defaultValue: '{*}',
		validate: validateRegex(helpers.maskingRegex, 'Please enter a valid value'),
	})) as string;

	return hostedAgentValues;
};

const askForAWSCredentials = async (hostedAgentValues: SaasAWSAgentValues): Promise<SaasAgentValues> => {
	hostedAgentValues.region = await helpers.askAWSRegion();

	log('gathering access details for aws');

	// Ask Auth type
	hostedAgentValues.authType = (await askList({
		msg: SaasPrompts.AUTHENTICATION_TYPE,
		default: AWSAuthType.ASSUME,
		choices: [
			{ name: AWSAuthType.ASSUME, value: AWSAuthType.ASSUME },
			{ name: AWSAuthType.KEYS, value: AWSAuthType.KEYS },
		],
	})) as AWSAuthType;

	console.log(chalk.gray('Please refer to docs.axway.com for information on creating the necessary AWS IAM policies'));

	if (hostedAgentValues.authType === AWSAuthType.ASSUME) {
		log('using an assume role policy authentication');
		// get assume role arn
		hostedAgentValues.assumeRole = (await askInput({
			msg: SaasPrompts.ASSUME_ROLE,
			defaultValue: hostedAgentValues.assumeRole !== '' ? hostedAgentValues.assumeRole : undefined,
			validate: validateRegex(
				helpers.AWSRegexPatterns.AWS_REGEXP_ROLE_ARN,
				helpers.invalidValueExampleErrMsg('assume role arn', 'arn:aws:iam::000000000000:role/name-of-role')
			),
		})) as string;

		// get external id
		hostedAgentValues.externalID = (await askInput({
			msg: SaasPrompts.EXTERNAL_ID,
			defaultValue: hostedAgentValues.externalID !== '' ? hostedAgentValues.externalID : undefined,
			allowEmptyInput: true,
		})) as string;
	} else {
		log('using key and secret authentication');
		// get access key
		hostedAgentValues.accessKey = (await askInput({
			msg: SaasPrompts.ACCESS_KEY,
			defaultValue: hostedAgentValues.accessKey !== '' ? hostedAgentValues.accessKey : undefined,
			validate: validateRegex(
				helpers.AWSRegexPatterns.AWS_REGEXP_ACCESS_KEY_ID,
				helpers.invalidValueExampleErrMsg('access key id', 'AKIAIOSFODNN7EXAMPLE')
			),
		})) as string;

		// get secret access key
		hostedAgentValues.secretKey = (await askInput({
			msg: SaasPrompts.SECRET_KEY,
			defaultValue: hostedAgentValues.secretKey !== '' ? hostedAgentValues.secretKey : undefined,
			validate: validateRegex(
				helpers.AWSRegexPatterns.AWS_REGEXP_SECRET_ACCESS_KEY,
				helpers.invalidValueExampleErrMsg('secret access key', 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')
			),
		})) as string;
	}
	return hostedAgentValues;
};

export const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<SaasAgentValues | SaasAWSAgentValues> => {
	console.log('\nCONNECTION TO AMAZON API GATEWAY:');
	console.log(
		chalk.gray(
			'The Discovery Agent needs to connect to the AWS API Gateway to discover API\'s for publishing to Amplify Engage'
		)
	);

	// DeploymentType
	let hostedAgentValues: SaasAgentValues = new SaasAgentValues();

	if (installConfig.gatewayType === GatewayTypes.AWS_GATEWAY) {
		// AWS connection details
		hostedAgentValues = new SaasAWSAgentValues();
		hostedAgentValues = await askForAWSCredentials(hostedAgentValues as SaasAWSAgentValues);
		(hostedAgentValues as SaasAWSAgentValues).stageTagName = (await askInput({
			msg: SaasPrompts.STAGE_TAG_NAME,
			validate: validateInputLength(
				STAGE_TAG_NAME_LENGTH,
				'Maximum length of \'stage tag name\' is 127'
			),
		})) as string;
		if (installConfig.switches.isTaEnabled) {
			console.log(chalk.gray('\nThe access log ARN is a cloud watch log group amazon resource name'));
			(hostedAgentValues as SaasAWSAgentValues).accessLogARN = (await askInput({
				msg: SaasPrompts.ACCESS_LOG_ARN,
				validate: validateRegex(
					helpers.AWSRegexPatterns.AWS_ACCESS_LOG_ARN,
					helpers.invalidValueExampleErrMsg(
						'access log arn',
						'arn:aws:logs:region:000000000000:log-group:log-group-name'
					)
				),
			})) as string;

			(hostedAgentValues as SaasAWSAgentValues).fullTransactionLogging = ((await askList({
				msg: SaasPrompts.FULL_TRANSACTION_LOGGING,
				default: YesNo.No,
				choices: YesNoChoices,
			})) as YesNo) === YesNo.Yes;
		}
	}

	// Ask to queue discovery now
	log('getting the frequency and if the agent should run now');
	console.log(
		chalk.gray(
			'\n00d00h00m format, where 30m = 30 minutes, 1h = 1 hour, 7d = 7 days, and 7d1h30m = 7 days 1 hour and 30 minutes. Minimum of 30m.'
		)
	);
	hostedAgentValues.frequencyDA = (await askInput({
		msg: SaasPrompts.DA_FREQUENCY,
		validate: validateFrequency(),
		allowEmptyInput: true,
	})) as string;

	hostedAgentValues.queueDA
		= ((await askList({
			msg: SaasPrompts.QUEUE,
			default: YesNo.No,
			choices: YesNoChoices,
		})) as YesNo) === YesNo.Yes;

	hostedAgentValues.filterDA = (await askInput({
		msg: SaasPrompts.DA_FILTER,
		allowEmptyInput: true,
	})) as string;

	if (installConfig.switches.isTaEnabled) {
		console.log(
			chalk.gray(
				'\n00d00h00m format, where 30m = 30 minutes, 1h = 1 hour, 7d = 7 days, and 7d1h30m = 7 days 1 hour and 30 minutes. Minimum of 30m.'
			)
		);
		hostedAgentValues.frequencyTA = (await askInput({
			msg: SaasPrompts.TA_FREQUENCY,
			defaultValue: '30m',
			validate: validateFrequency(),
			allowEmptyInput: true,
		})) as string;

		hostedAgentValues = await askForRedaction(hostedAgentValues);
	}

	return hostedAgentValues;
};

const generateOutput = async (installConfig: AgentInstallConfig): Promise<string> => {
	return `Install complete of hosted agent for ${installConfig.gatewayType} region`;
};

const createEncryptedAccessData = async (
	hostedAgentValues: SaasAgentValues | IDPAuthConfiguration,
	dataplaneRes: GenericResource
): Promise<string> => {
	// grab key from data plane resource
	const key = dataplaneRes.security?.encryptionKey || '';
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

export const completeInstall = async (installConfig: AgentInstallConfig,
	apiServerClient?: ApiServerClient,
	defsManager?: DefinitionsManager
): Promise<void> => {
	/**
	 * Create agent resources
	 */
	console.log('\n');
	const awsAgentValues = installConfig.gatewayConfig as SaasAgentValues;
	const resourceFuncsForCleanup = [];
	const referencedIDPs = [];
	const providedIDPs = installConfig.idpConfig[0];
	const providedIDPAuths = installConfig.idpConfig[1];
	// create Identity Provider resource
	try {
		for (let i = 0; i < providedIDPs.length; i++) {
			const idpResource = await helpers.createNewIDPResource(
				apiServerClient as ApiServerClient,
				defsManager as DefinitionsManager,
				providedIDPs[i],
			);
			const cleanupFunc = async () => await helpers.deleteByResourceType(
				apiServerClient as ApiServerClient,
				defsManager as DefinitionsManager,
				idpResource?.name as string,
				'IdentityProvider',
				'idp'
			);
			resourceFuncsForCleanup.push(cleanupFunc);
			referencedIDPs.push({
				name: idpResource?.name
			});
			log(idpResource);

			const encryptedAccessData = await createEncryptedAccessData(providedIDPAuths[i], idpResource as GenericResource);
			providedIDPAuths[i].setAccessData(encryptedAccessData);

			const idpSecResource = await helpers.createNewIDPSecretResource(
				apiServerClient as ApiServerClient,
				defsManager as DefinitionsManager,
				providedIDPAuths[i],
				idpResource as GenericResource,
			);
			const anotherCleanupFunc = async () => await helpers.deleteByResourceType(
				apiServerClient as ApiServerClient,
				defsManager as DefinitionsManager,
				idpSecResource?.name as string,
				'IdentityProviderSecret',
				'idpsec',
				idpResource?.name
			);
			resourceFuncsForCleanup.push(anotherCleanupFunc);
		}

	} catch (error) {
		log(error);
		console.log(
			chalk.redBright('rolling back installation. Could not create the Identity Provider resources')
		);
		await cleanResources(resourceFuncsForCleanup);
		return;
	}

	const refIDPsSubResources = {
		references: {
			identityProviders: referencedIDPs
		}
	};
	// create the environment, if necessary
	if (installConfig.centralConfig.ampcEnvInfo.isNew) {
		installConfig.centralConfig.environment = await helpers.createByResourceType(
			apiServerClient as ApiServerClient,
			defsManager as DefinitionsManager,
			installConfig.centralConfig.ampcEnvInfo.name,
			'Environment',
			'env',
			{
				axwayManaged: installConfig.centralConfig.axwayManaged,
				production: installConfig.centralConfig.production,
			},
			'',
			refIDPsSubResources
		);
		const cleanupFunc = async () => await helpers.deleteByResourceType(
			apiServerClient as ApiServerClient,
			defsManager as DefinitionsManager,
			installConfig.centralConfig.ampcEnvInfo.name,
			'Environment',
			'env'
		);
		resourceFuncsForCleanup.push(cleanupFunc);
	} else {
		// if the env exists, we simply update the references with the newly created IDPs, while preserving the existing IDP references
		// In the case of any failure during the whole process, we return everything back to how it was before.
		installConfig.centralConfig.environment = installConfig.centralConfig.ampcEnvInfo.name;
		refIDPsSubResources.references.identityProviders.push(...installConfig.centralConfig.ampcEnvInfo.referencedIdentityProviders);
		await helpers.updateSubResourceType(
			apiServerClient as ApiServerClient,
			defsManager as DefinitionsManager,
			installConfig.centralConfig.ampcEnvInfo.name,
			'Environment',
			'env',
			'',
			refIDPsSubResources,
		);
		const oldIDPRef = {
			references: {
				identityProviders: installConfig.centralConfig.ampcEnvInfo.referencedIdentityProviders
			}
		};
		const cleanupFunc = async () => await helpers.updateSubResourceType(
			apiServerClient as ApiServerClient,
			defsManager as DefinitionsManager,
			installConfig.centralConfig.ampcEnvInfo.name,
			'Environment',
			'env',
			'',
			oldIDPRef,
		);
		resourceFuncsForCleanup.push(cleanupFunc);
	}

	if (installConfig.gatewayType === GatewayTypes.AWS_GATEWAY) {
		if (installConfig.switches.isTaEnabled) {
			awsAgentValues.dataplaneConfig
				= new AWSDataplaneConfig((awsAgentValues as SaasAWSAgentValues).accessLogARN,
					(awsAgentValues as SaasAWSAgentValues).fullTransactionLogging, (awsAgentValues as SaasAWSAgentValues).stageTagName);
		} else {
			awsAgentValues.dataplaneConfig = new DataplaneConfig('AWS');
		}
	}

	// create the data plane resource
	let dataplaneRes: GenericResource;
	try {
		dataplaneRes = await helpers.createNewDataPlaneResource(
			apiServerClient as ApiServerClient,
			defsManager as DefinitionsManager,
			installConfig.centralConfig.environment,
			GatewayTypeToDataPlane[installConfig.gatewayType as GatewayTypes],
			awsAgentValues.dataplaneConfig
		);
		const cleanupFunc = async () => await helpers.deleteByResourceType(
			apiServerClient as ApiServerClient,
			defsManager as DefinitionsManager,
			dataplaneRes.name,
			'Dataplane',
			'dp',
			installConfig.centralConfig.environment
		);
		resourceFuncsForCleanup.push(cleanupFunc);
	} catch (_error) {
		console.log(
			chalk.redBright('rolling back installation. Please check the configuration data before re-running install')
		);
		await cleanResources(resourceFuncsForCleanup);
		return;
	}

	// create data plane secret resource
	try {
		const dataplaneSecretRes = await helpers.createNewDataPlaneSecretResource(
			apiServerClient as ApiServerClient,
			defsManager as DefinitionsManager,
			installConfig.centralConfig.environment,
			GatewayTypeToDataPlane[installConfig.gatewayType as GatewayTypes],
			dataplaneRes.name,
			await createEncryptedAccessData(awsAgentValues, dataplaneRes)
		);
		const cleanupFunc = async () => await helpers.deleteByResourceType(
			apiServerClient as ApiServerClient,
			defsManager as DefinitionsManager,
			dataplaneSecretRes?.name as string,
			'DataplaneSecret',
			'dps',
			installConfig.centralConfig.environment);
		resourceFuncsForCleanup.push(cleanupFunc);
	} catch (_error) {
		console.log(
			chalk.redBright('rolling back installation. Please check the credential data before re-running install')
		);
		await cleanResources(resourceFuncsForCleanup);
		return;
	}

	// create discovery agent resource
	installConfig.centralConfig.daAgentName = await helpers.createNewAgentResource(
		apiServerClient as ApiServerClient,
		defsManager as DefinitionsManager,
		installConfig.centralConfig.environment,
		GatewayTypeToDataPlane[installConfig.gatewayType as GatewayTypes],
		AgentResourceKind.da,
		AgentTypes.da,
		installConfig.centralConfig.ampcTeamName,
		GatewayTypeToDataPlane[installConfig.gatewayType as GatewayTypes] + ' Discovery Agent',
		dataplaneRes.name,
		awsAgentValues.frequencyDA,
		awsAgentValues.queueDA,
		undefined,
		awsAgentValues.filterDA
	);

	if (installConfig.switches.isTaEnabled) {
		// create traceability agent resource
		installConfig.centralConfig.taAgentName = await helpers.createNewAgentResource(
			apiServerClient as ApiServerClient,
			defsManager as DefinitionsManager,
			installConfig.centralConfig.environment,
			GatewayTypeToDataPlane[installConfig.gatewayType as GatewayTypes],
			AgentResourceKind.ta,
			AgentTypes.ta,
			installConfig.centralConfig.ampcTeamName,
			GatewayTypeToDataPlane[installConfig.gatewayType as GatewayTypes] + ' Traceability Agent',
			dataplaneRes.name,
			awsAgentValues.frequencyTA,
			false, // AWS TA is never triggered at install, as DA has to run prior
			{ redaction: awsAgentValues.redaction }
		);
	}

	console.log(await generateOutput(installConfig));
};

export const AWSSaaSInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	AgentNameMap: {
		[AgentTypes.da]: AgentNames.AWS_DA,
		[AgentTypes.ta]: AgentNames.AWS_TA,
	},
	GatewayDisplay: SaaSGatewayTypes.AWS_GATEWAY,
};

type wrappedCleanupFunc = () => Promise<void>;
// These are useful because there are multiple resources created in a specific order and in case of failure, this goes through
// everything that was created and deletes it one by one. It deletes the resources in opposite order because resources added
// at the beginning might be referred by resources added afterwards
const cleanResources = async (cleanupFuncs: wrappedCleanupFunc[]): Promise<void> => {

	for (let i = cleanupFuncs.length - 1; i >= 0; i--) {
		await cleanupFuncs[i]();
	}
};

