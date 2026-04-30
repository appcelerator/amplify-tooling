import chalk from 'chalk';
import inquirer from 'inquirer';
import { ApiServerClient } from '../../clients-external/apiserverclient.js';
import { askInput, askList, InputValidation, runValidations, validateInputIsNew, validateRegex, validateValueRange } from '../../utils/basic-prompts.js';
import { DefinitionsManager } from '../../results/DefinitionsManager.js';
import { kubectl } from '../../utils/agents/kubectl.js';
import { PlatformClient, PlatformServiceAccountRole } from '../../clients-external/platformclient.js';
import {
	AgentTypes,
	AWSRegions,
	BundleType,
	DOSAConfigInfo,
	EnvironmentConfigInfo,
	GenericResource,
	IDPAuthAccessToken,
	IDPAuthClientSecret,
	IDPAuthConfiguration,
	IDPAuthType,
	IDPClientSecretAuthMethod,
	IDPConfiguration,
	IDPType,
	YesNo,
	YesNoChoices,
} from '../../types.js';
import { getListByResource } from '../../utils/agents/getters.js';
import {
	dosaRegex,
	GitLabRegexPatterns,
	invalidDosaName,
	invalidNamespace,
	invalidResourceMsg,
	keyFromKeyValuePairRegex,
	namespaceRegex,
	resourceRegex,
} from '../../utils/regex.js';
import logger from '../../../logger.js';

const { log } = logger('lib: engage: utils: agents: input');

const cliNowString = `cli-${Date.now()}`;

export const envMessages = {
	createNewEnvironment: 'Create a new environment',
	enterEnvironmentName: 'Enter a new environment name',
	isProduction: 'Is the environment used for production purpose?',
	selectEnvironment: 'Select an environment',
	selectReferencedEnvironment: 'Select a referenced environment',
	selectMoreWithExistingRefEnv: 'Selected environment already contains references, do you want to select more',
	selectMoreRefEnv: 'Do you want to select more referenced environment',
	getEnvironmentsError: 'Get environments error.',
	environmentAlreadyExists: 'Environment already exists. Please enter a new name.',
	selectTeam: 'Select a team',
};

export const clusterMessages = {
	enterClusterName: 'Enter a unique cluster name'
};

export const agentMessages = {
	enterDiscoveryAgentName: 'Enter a new discovery agent name',
	enterTraceabilityAgentName: 'Enter a new traceability agent name',
	enterComplianceAgentName: 'Enter a new compliance agent name',
	getAgentsError: 'Error getting agents.',
	agentAlreadyExists: 'Agent already exists. Please enter a new name.',
	selectAgentType: 'Select the type of agent(s) you want to install',
};

export const idpMessages = {
	addIDP: 'Choose if you want to add an IDP Configuration. Multiple Identity providers can be configured',
	enterTitle: 'Enter the title of the IDP config',
	selectType: 'Select the type of the IDP',
	enterMetadataURL: 'Enter the metadata URL',
	provideReqHeadersRegistration: 'Add request headers used for registration calls as key-value pairs. Stops when empty key is provided',
	provideQueryParamsRegistration: 'Add query parameters used for registration calls as key-value pairs. Stops when empty key is provided',
	provideClientProperties: 'Enter additional client properties used for registration calls as key-value pairs. Stops when empty key is provided',
	enterClientTimeout: 'Enter client timeout (in seconds) for dynamic registration calls. Defaults to 60s. Minimum 30s',
	selectAuthType: 'Select the auth type',
	enterToken: 'Enter the access token',
	selectClientSecretAuthMethod: 'Select the auth method for ClientSecret based auth',
	enterClientID: 'Enter the clientID',
	enterClientSecret: 'Enter the clientSecret',
	enterClientScopes: 'Enter the list of scope names',
	provideReqHeadersForTokenFetch: 'Enter the request headers used for the token fetch call as key-value pairs. Stops when empty input is provided',
	provideQueryParamsForTokenFetch: 'Enter the query parameters used for the token fetch call as key-value pairs. Stops when empty input is provided',
};

export const namespaceAlreadyExists = 'Namespace already exists. Please enter a new name.';
export const secretAlreadyExists = 'Secret already exists. Please enter a new name.';
export const enterNamespaceName = 'Enter a new namespace name';
export const selectServiceAccount = 'Select a service account';
export const enterServiceAccountName = 'Enter a new service account name';
export const enterPublicKeyPath = 'Enter the file path to the public key';
export const enterPrivateKeyPath = 'Enter the file path to the private key';
export const serviceAccountNameAlreadyExists = 'Service account already exists.  Please enter a new name.';
export const selectAWSRegion = 'Select an AWS Region';
export const enterAWSRegion = 'Enter an AWS Region';

export const askAWSRegion = async (region: string = ''): Promise<string> => {
	const regions = Object.values(AWSRegions).map((str) => ({ name: str, value: str }));
	const answer = await askList({
		msg: selectAWSRegion,
		default: region,
		choices: [
			{ name: 'Enter an AWS Region not on the list', value: 'CREATE_NEW' },
			...regions,
		],
	});
	if (answer === 'CREATE_NEW') {
		return (await askInput({ msg: enterAWSRegion })) as string;
	} else {
		return answer;
	}
};
export const askServiceAccountName = async (serviceAccountNames: string[]): Promise<string> => {
	console.warn(
		chalk.yellow(
			'WARNING: Creating a new service account will overwrite any existing "private_key.pem" and "public_key.pem" files in this directory'
		)
	);

	const name = (await askInput({
		msg: enterServiceAccountName,
		defaultValue: cliNowString,
		validate: runValidations(
			validateInputIsNew(serviceAccountNames, serviceAccountNameAlreadyExists),
			validateRegex(dosaRegex, invalidDosaName)
		),
	})) as string;
	return name;
};

export const askDosaClientId = async (client: PlatformClient, showWarning: boolean = true): Promise<DOSAConfigInfo> => {
	// Fetch all existing service accounts.
	const serviceAccounts = await client.getServiceAccounts(PlatformServiceAccountRole.ApiCentralAdmin);
	const serviceAccountNames = serviceAccounts.map((nextAccount) => nextAccount.name);

	// Ask user to select an existing service account or create a new one.
	const selectedName = await askList({
		msg: selectServiceAccount,
		choices: [
			{ name: 'Create a new service account', value: 'CREATE_NEW' },
			new inquirer.Separator(),
			...serviceAccountNames,
			new inquirer.Separator(),
		],
	});
	if (selectedName === 'CREATE_NEW') {
		// We're going to create a new service account. Ask for a unique name. (We'll create it later.)
		const name = await askServiceAccountName(serviceAccountNames);
		return { clientId: null, name, isNew: true } as DOSAConfigInfo;
	} else {
		// We're using an existing service account. Notify user to make its keys available to the agents.
		if (showWarning) {
			console.log(
				chalk.yellow(
					'Please make sure your "private_key.pem" and "public_key.pem" files for the selected service account are in this installation folder.'
				)
			);
		}

		// Fetch selected service account's client ID and return info about it.
		const selectedAccount = serviceAccounts.find((nextAccount) => nextAccount.name === selectedName);
		return { clientId: selectedAccount?.client_id, name: selectedName, isNew: false } as DOSAConfigInfo;
	}
};

export const askNamespace = async (msg: string, defaultValue: string): Promise<{ name: string; isNew: boolean }> => {
	const namespaces = await kubectl.get('ns');
	if (namespaces.error) {
		throw Error(namespaces.error);
	}

	const answer = await askList({
		msg,
		choices: [
			{ name: 'Create a new namespace', value: 'CREATE_NEW' },
			new inquirer.Separator(),
			...namespaces.data,
			new inquirer.Separator(),
		],
	});

	if (answer === 'CREATE_NEW') {
		const name = (await askInput({
			msg: enterNamespaceName,
			defaultValue,
			validate: runValidations(
				validateInputIsNew(namespaces.data, namespaceAlreadyExists),
				validateRegex(namespaceRegex, invalidNamespace)
			),
		})) as string;
		return { name, isNew: true };
	} else {
		return { name: answer, isNew: false };
	}
};

export const askForSecretName = async (msg: string, defaultValue: string, options: string[]): Promise<string> => {
	return (await askInput({
		msg,
		defaultValue,
		validate: runValidations(
			validateInputIsNew(options, secretAlreadyExists),
			validateRegex(resourceRegex, invalidResourceMsg('Secret'))
		),
	})) as string;
};

export const askBundleType = async (choices: BundleType[]): Promise<BundleType> =>
	(await askList({
		msg: agentMessages.selectAgentType,
		choices: choices,
	})) as BundleType;

export const askEnvironmentName = async (
	client: ApiServerClient,
	defsManager: DefinitionsManager,
	isAxwayManaged: boolean | null = null,
	gatewayType?: string
): Promise<EnvironmentConfigInfo> => {
	let envs: GenericResource[];
	if (isAxwayManaged === null) {
		// do not filter any environments
		const { data: allEnvs } = await getListByResource({
			client,
			defsManager,
			resourceType: 'Environment',
			resourceShortName: 'env',
		});
		if (!allEnvs) {
			throw Error(envMessages.getEnvironmentsError);
		}
		envs = allEnvs;
	} else {
		// Get only the axway managed environments
		const { data: axwayManagedEnvs } = await getListByResource({
			client,
			defsManager,
			resourceType: 'Environment',
			resourceShortName: 'env',
			query: 'spec.axwayManaged==true',
		});
		if (!axwayManagedEnvs) {
			throw Error(envMessages.getEnvironmentsError);
		}
		envs = axwayManagedEnvs;
		if (!isAxwayManaged) {
			const { data: allEnvs } = await getListByResource({
				client,
				defsManager,
				resourceType: 'Environment',
				resourceShortName: 'env',
			});
			if (!allEnvs) {
				throw Error(envMessages.getEnvironmentsError);
			}

			// Remove any axway managed envs from the array when isAxwayManaged is false
			envs = allEnvs.filter((env) => {
				return !envs.find((axwayManagedEnv) => env.name === axwayManagedEnv.name);
			});
		}
	}

	const answer = await askList({
		msg: envMessages.selectEnvironment,
		choices: [
			{ name: envMessages.createNewEnvironment, value: 'CREATE_NEW' },
			new inquirer.Separator(),
			...envs.map((e) => e.name).sort((name1, name2) => name1.localeCompare(name2)),
			new inquirer.Separator(),
		],
	});
	if (answer === 'CREATE_NEW') {
		const name = (await askInput({
			msg: envMessages.enterEnvironmentName,
			defaultValue: cliNowString,
			validate: runValidations(
				validateInputIsNew(
					envs.map((env) => env.name),
					envMessages.environmentAlreadyExists
				),
				validateRegex(resourceRegex, invalidResourceMsg('Environment'))
			),
		})) as string;
		return { name, isNew: true } as EnvironmentConfigInfo;
	} else {
		// Check if user is installing Traceable agent and there's only 1 existing environment - exit gracefully
		if (gatewayType === 'Traceable' && envs.length === 1) {
			console.log(chalk.yellow('Warning: The Traceable agent requires at least one Engage environment before installing.'));
			console.log(chalk.gray('Installation cancelled. You can create more environments using: axway engage create environment'));
			process.exit(0);
		}
		const selectedEnv = envs.find((env) => env.name === answer);
		return {
			name: answer,
			isNew: false,
			referencedEnvironments: selectedEnv?.references?.managedEnvironments ? selectedEnv?.references?.managedEnvironments : [],
			referencedIdentityProviders: selectedEnv?.references?.identityProviders ? selectedEnv?.references?.identityProviders : [],
		} as EnvironmentConfigInfo;
	}
};

export const getCentralEnvironments = async (client: ApiServerClient,
	defsManager: DefinitionsManager) : Promise<GenericResource[] | null> => {
	const envs: GenericResource[] = [];
	const { data: allEnvs } = await getListByResource({
		client,
		defsManager,
		resourceType: 'Environment',
		resourceShortName: 'env',
	});
	if (!allEnvs) {
		throw Error(envMessages.getEnvironmentsError);
	}
	envs.push(...allEnvs);
	return envs;
};

export const askReferencedEnvironments = async (
	client: ApiServerClient,
	defsManager: DefinitionsManager,
	envInfo: EnvironmentConfigInfo,
): Promise<string[]> => {
	if (envInfo.referencedEnvironments?.length > 0) {
		const choice = await askList({
			msg: envMessages.selectMoreWithExistingRefEnv,
			default: YesNo.No,
			choices: YesNoChoices,
		}) === YesNo.Yes;
		if (!choice) {
			return envInfo.referencedEnvironments;
		}
	}

	// filter all environments not referencing other environment
	const { data: allEnvs } = await getListByResource({
		client,
		defsManager,
		resourceType: 'Environment',
		resourceShortName: 'env',
		query: 'metadata.references.kind!=Environment'
	});
	if (!allEnvs) {
		throw Error(envMessages.getEnvironmentsError);
	}

	let askReferencedEnvironments = true;
	const selectedRefEnv = envInfo.referencedEnvironments ? [ ...envInfo.referencedEnvironments ] : [];

	const envFilter = (name: string) => {
		return !selectedRefEnv?.includes(name) && name !== envInfo.name;
	};
	while (askReferencedEnvironments) {
		const selectedEnv = await askList({
			msg: envMessages.selectReferencedEnvironment,
			choices: [
				...allEnvs.filter((e) => envFilter(e.name)).map((e) => e.name).sort((n, m) => n.localeCompare(m)),
			],
		});

		selectedRefEnv.push(selectedEnv);
		askReferencedEnvironments = await askList({
			msg: envMessages.selectMoreRefEnv,
			default: YesNo.No,
			choices: YesNoChoices,
		}) === YesNo.Yes;
	}
	return selectedRefEnv;
};
export const askClusterName = async (): Promise<string> => {
	const name = (await askInput({
		msg: clusterMessages.enterClusterName,
		defaultValue: cliNowString,
		validate: runValidations(
			validateRegex(resourceRegex, invalidResourceMsg('Cluster'))
		),
	})) as string;
	return name;
};

export const askAgentName = async (
	client: ApiServerClient,
	defsManager: DefinitionsManager,
	agentType: AgentTypes,
	scopeName: string
): Promise<string> => {
	let resourceType;
	let resourceShortName;
	let msg;
	switch (agentType) {
		case AgentTypes.da: {
			resourceType = 'DiscoveryAgent';
			resourceShortName = 'da';
			msg = agentMessages.enterDiscoveryAgentName;
			break;
		}
		case AgentTypes.ta: {
			resourceType = 'TraceabilityAgent';
			resourceShortName = 'ta';
			msg = agentMessages.enterTraceabilityAgentName;
			break;
		}
		case AgentTypes.ca: {
			resourceType = 'ComplianceAgent';
			resourceShortName = 'ca';
			msg = agentMessages.enterComplianceAgentName;
			break;
		}
	}

	let { data: agents } = await getListByResource({ client, defsManager, resourceType, resourceShortName, scopeName });
	// if there are no agents scoped to the env, make the agents list blank to validate against
	agents = agents ?? [];

	const name = (await askInput({
		msg: msg,
		defaultValue: cliNowString,
		validate: runValidations(
			validateInputIsNew(
				agents.map((a) => a.name),
				agentMessages.agentAlreadyExists
			),
			validateRegex(resourceRegex, invalidResourceMsg(resourceType))
		),
	})) as string;
	return name;
};

/**
 * @description Create a secret that contains a public & private key pair for agents to connect to central.
 * If a user is creating a new service account, then the keys should be passed in as args.
 * If they are using an existing account, then the user will be prompted for the keys that created the service account.
 * @param namespace The namespace to create the secret in.
 * @param secretName The name of the secret.
 * @param publicKey The file path to the public key attached to the chosen service account.
 * @param privateKey The file path to the corresponding private key.
 */
export const createAmplifyAgentKeysSecret = async (
	namespace: string,
	secretName: string,
	publicKeyName: string,
	publicKey: string,
	privateKeyName: string,
	privateKey: string
): Promise<void> => {
	const { error } = await kubectl.create(
		'secret',
		`-n ${namespace} generic ${secretName} --from-file=${publicKeyName}=${publicKey} --from-file=${privateKeyName}=${privateKey} --from-literal=password=""`
	);
	if (error) {
		throw new Error(error);
	}
	console.log(`Created ${secretName} in the ${namespace} namespace.`);
};

export const createNamespace = async (namespace: string) => {
	const res = await kubectl.create('ns', namespace);
	if (res.error) {
		throw new Error(res.error);
	}
	console.log(`Created namespace ${namespace}.`);
	return namespace;
};

export const createGatewayAgentCredsSecret = async (
	namespace: string,
	secretName: string,
	apiManagerAuthUser: string,
	apiManagerAuthPass: string,
	apiGatewayAuthUser: string,
	apiGatewayAuthPass: string
): Promise<void> => {
	const { error } = await kubectl.create(
		'secret',
		`-n ${namespace} generic ${secretName} \
		--from-literal=APIMANAGER_AUTH_USERNAME=${apiManagerAuthUser} \
		--from-literal=APIMANAGER_AUTH_PASSWORD=${apiManagerAuthPass} \
		--from-literal=APIGATEWAY_AUTH_USERNAME=${apiGatewayAuthUser} \
		--from-literal=APIGATEWAY_AUTH_PASSWORD=${apiGatewayAuthPass}`
	);
	if (error) {
		throw Error(error);
	}
	console.log(`Created ${secretName} in the ${namespace} namespace.`);
};

export const askPublicKeyPath = async (): Promise<string> =>
	(await askInput({
		msg: enterPublicKeyPath,
		defaultValue: 'public_key.pem',
	})) as string;

export const askPrivateKeyPath = async (): Promise<string> =>
	(await askInput({
		msg: enterPrivateKeyPath,
		defaultValue: 'private_key.pem',
	})) as string;

export const askPublicAndPrivateKeysPath = async (): Promise<string[]> => {
	console.log(
		chalk.yellow(
			'Please provide the same "private_key.pem" and "public_key.pem" that was used to create the selected Service Account.'
		)
	);
	const publicKey = await askPublicKeyPath();
	const privateKey = await askPrivateKeyPath();
	return [ publicKey, privateKey ];
};

export const askKeyValuePairLoop = async (
	msg: string,
	keyLabel: string,
	validateFunc?: InputValidation,
): Promise<Map<string, string>> => {
	let key = 'non-empty';
	const map = new Map<string, string>();
	console.log(chalk.cyan(msg));
	while (key !== '') {
		key = (await askInput({
			msg: `Enter the ${keyLabel} name`,
			allowEmptyInput: true,
			validate: validateFunc,
		})) as string;

		if (key === '') {
			return map;
		}

		const value = (await askInput({
			msg: `Enter the ${keyLabel} value`,
		})) as string;

		map.set(key, value);
	}
	return map;
};

export const askArrayLoop = async (
	msg: string,
): Promise<string[]> => {
	let value = 'non-empty';
	const array: string[] = [];
	console.log(chalk.gray(msg));
	while (value !== '') {
		value = (await askInput({
			msg: 'Enter the value',
			allowEmptyInput: true,
		})) as string;

		if (value === '') {
			return array;
		}

		array.push(value);
	}
	return array;
};

export const addIdentityProvider = async (): Promise<[IDPConfiguration[], IDPAuthConfiguration[]]>  => {
	const providedIDPs = [];
	const providedIDPAuths = [];
	while (await askList({
		msg: idpMessages.addIDP,
		choices: YesNoChoices,
		default: YesNo.Yes,
	}) === YesNo.Yes) {
		console.log('starting IDP Configuration process');
		let idpConfig = new IDPConfiguration();
		idpConfig = await askForIDPConfiguration(idpConfig);
		providedIDPs.push(idpConfig);

		let idpAuthConfig = new IDPAuthConfiguration();
		idpAuthConfig = await askForIDPAuthConfiguration(idpAuthConfig);
		providedIDPAuths.push(idpAuthConfig);
	}
	return [ providedIDPs, providedIDPAuths ];
};

const askForIDPAuthAccessToken = async (idpAuth: IDPAuthAccessToken): Promise<IDPAuthAccessToken> => {
	console.log(chalk.gray('gathering the access token auth configuration'));

	idpAuth.token = (await askInput({
		msg: idpMessages.enterToken,
	})) as string;

	return idpAuth;
};

const askForIDPAuthClientSecret = async (idpAuth: IDPAuthClientSecret): Promise<IDPAuthClientSecret> => {

	console.log(chalk.gray('gathering the client secret auth configuration'));
	idpAuth.authMethod = (await askList({
		msg: idpMessages.selectClientSecretAuthMethod,
		choices: [
			{ name: IDPClientSecretAuthMethod.ClientSecretBasic, value:  IDPClientSecretAuthMethod.ClientSecretBasic },
			{ name: IDPClientSecretAuthMethod.ClientSecretPost, value: IDPClientSecretAuthMethod.ClientSecretPost },
			{ name: IDPClientSecretAuthMethod.ClientSecretJWT, value: IDPClientSecretAuthMethod.ClientSecretJWT },
		],
	})) as IDPClientSecretAuthMethod;

	idpAuth.clientID = (await askInput({
		msg: idpMessages.enterClientID
	})) as string;

	idpAuth.clientSecret = (await askInput({
		msg: idpMessages.enterClientSecret
	})) as string;

	idpAuth.clientScopes = (await idpTestables.askArrayLoop(
		idpMessages.enterClientScopes
	)) as string[];
	return idpAuth;
};

export const askForIDPConfiguration = async (
	idpConfigValues: IDPConfiguration,
): Promise<IDPConfiguration> => {
	console.log(chalk.gray('gathering idp configuration for azure'));

	idpConfigValues.title = (await askInput({
		msg: idpMessages.enterTitle,
	})) as string;

	idpConfigValues.type = (await askList({
		msg: idpMessages.selectType,
		choices: [
			{ name: IDPType.Generic, value: IDPType.Generic },
			{ name: IDPType.KeyCloak, value: IDPType.KeyCloak },
			{ name: IDPType.Okta, value: IDPType.Okta },
		],
	})) as IDPType;

	idpConfigValues.metadataURL = (await askInput({
		msg: idpMessages.enterMetadataURL,
		validate: validateRegex(GitLabRegexPatterns.gitLabBaseURLRegex, 'metadataURL must have a valid URL format')
	})) as string;

	idpConfigValues.requestHeaders = (await idpTestables.askKeyValuePairLoop(
		idpMessages.provideReqHeadersRegistration,
		'request header',
		validateRegex(keyFromKeyValuePairRegex, 'Please enter a valid value')
	));

	idpConfigValues.queryParameters = (await idpTestables.askKeyValuePairLoop(
		idpMessages.provideQueryParamsRegistration,
		'query parameter',
		validateRegex(keyFromKeyValuePairRegex, 'Please enter a valid value')
	)) as Map<string, string>;

	idpConfigValues.clientProperties = (await idpTestables.askKeyValuePairLoop(
		idpMessages.provideClientProperties,
		'client property',
		validateRegex(keyFromKeyValuePairRegex, 'Please enter a valid value'),
	)) as Map<string, string>;

	idpConfigValues.clientTimeout = (await askInput({
		type: 'number',
		msg: idpMessages.enterClientTimeout,
		validate: validateValueRange(30, 600),
		defaultValue: 60,
		allowEmptyInput: true,
	})) as number;

	return idpConfigValues;
};

export const askForIDPAuthConfiguration = async (
	idpConfigValues: IDPAuthConfiguration,
): Promise<IDPAuthConfiguration> => {
	console.log(chalk.gray('gathering idp auth configuration for azure'));
	idpConfigValues.authType = (await askList({
		msg: idpMessages.selectAuthType,
		choices: [
			{ name: IDPAuthType.AccessToken, value: IDPAuthType.AccessToken },
			{ name: IDPAuthType.ClientSecret, value: IDPAuthType.ClientSecret },
		],
	})) as IDPAuthType;
	log(idpConfigValues.authType);
	switch (idpConfigValues.authType) {
		case IDPAuthType.AccessToken: {
			const auth = new IDPAuthAccessToken();
			idpConfigValues.authConfig = await askForIDPAuthAccessToken(auth);
			break;
		}
		case IDPAuthType.ClientSecret: {
			const auth = new IDPAuthClientSecret();
			idpConfigValues.authConfig = await askForIDPAuthClientSecret(auth);
			break;
		}
	}

	idpConfigValues.requestHeaders = (await idpTestables.askKeyValuePairLoop(
		idpMessages.provideReqHeadersForTokenFetch,
		'request header',
		validateRegex(keyFromKeyValuePairRegex, 'Please enter a valid value'),
	)) as Map<string, string>;

	idpConfigValues.queryParameters = (await idpTestables.askKeyValuePairLoop(
		idpMessages.provideQueryParamsForTokenFetch,
		'query parameter',
		validateRegex(keyFromKeyValuePairRegex, 'Please enter a valid value'),
	)) as Map<string, string>;

	return idpConfigValues;
};

// exported inside another object because we want to mock this function when testing
export const idpTestables = {
	addIdentityProvider,
	askKeyValuePairLoop,
	askArrayLoop
};

