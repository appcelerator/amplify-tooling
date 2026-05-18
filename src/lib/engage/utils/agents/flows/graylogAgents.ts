import chalk from 'chalk';
import { InstallationFlowMethods } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BundleType, GatewayTypes } from '../../../types.js';
import { askInput, validateRegex } from '../../basic-prompts.js';
import { AgentHelmInfo, helmImageSecretInfo, helmInstallInfo, writeTemplates } from '../../utils.js';
import { GraylogAgentValues } from '../index.js';
import * as helpers from '../index.js';
import { kubectl } from '../kubectl.js';

export const amplifyAgentsNs = 'amplify-agents';

// ConfigFiles - all the config file that are used in the setup
export const ConfigFiles = {
	helmOverride: 'agent-overrides.yaml',
};

// GraylogPrompts - prompts for user inputs
const prompts = {
	agentNamespace: 'Enter the namespace to use for the Amplify Graylog Agents',
	enterUrl: 'Enter the Graylog base URL that the agent will use',
	enterUsername: 'Enter the Graylog user name',
	enterPassword: 'Enter the password for Graylog user',
	enterBasePathSegmentLen: 'Enter the base path segment length that agent will use for lookup',
};

export const askBundleType = async (): Promise<BundleType> => {
	return  BundleType.TRACEABILITY as BundleType;
};

export const askConfigType = async (): Promise<AgentConfigTypes> => {
	return AgentConfigTypes.HELM;
};

//
// Questions for the configuration of Graylog agent
//
const askURL = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterUrl,
		allowEmptyInput: false,
		validate: validateRegex(
			helpers.GitLabRegexPatterns.gitLabBaseURLRegex,
			helpers.invalidValueExampleErrMsg('BaseURL', 'https://www.testdomain.com')
		)
	})) as string;

const askUsername = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterUsername,
		allowEmptyInput: false,
	})) as string;

const askPassword = async (): Promise<string> =>
	(await askInput({
		msg: prompts.enterPassword,
	})) as string;

const askBasePathSegmentLen = async (): Promise<number> =>
	(await askInput({
		msg: prompts.enterBasePathSegmentLen,
		type: 'number',
		defaultValue: 2
	})) as number;

export const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<GraylogAgentValues> => {
	installConfig.log(
		chalk.gray('The Amplify Graylog Agent needs to be deployed to your Kubernetes cluster to discover APIs for publishing to Amplify Engage.')
	);

	const { error } = await kubectl.isInstalled();
	if (error) {
		throw new Error(
			`Kubectl is required to fill out the following prompts. It appears to be missing or misconfigured.\n${error}`
		);
	}

	const graylogAgentValues: GraylogAgentValues = new GraylogAgentValues();
	graylogAgentValues.namespace = await helpers.askNamespace(prompts.agentNamespace, amplifyAgentsNs);
	graylogAgentValues.url = await askURL();
	graylogAgentValues.userName = await askUsername();
	graylogAgentValues.password = await askPassword();
	graylogAgentValues.basePathSegmentLen = await askBasePathSegmentLen();

	return graylogAgentValues;
};

const generateSuccessHelpMsg = (namespace: string, log: (text: string) => void = () => {}) => {
	log(`Graylog Agent override file has been placed at ${process.cwd()}/${ConfigFiles.helmOverride}`);
	helmImageSecretInfo(namespace, log);

	const agentHelmInfo = new Set<AgentHelmInfo>();
	agentHelmInfo.add({
		helmReleaseName: 'graylog-agent',
		helmChartName: 'axway/graylog-agent',
		overrideFileName: ConfigFiles.helmOverride,
		imageSecretOverrides: '--set image.pullSecret=<image-pull-secret-name>' });

	helmInstallInfo(
		'Graylog',
		namespace,
		agentHelmInfo,
		log
	);

	log('Configuration file(s) have been successfully created.\n');

	log(
		chalk.gray(`\nAdditional information about agent features can be found here:\n${helpers.agentsDocsUrl.GRAYLOG}`)
	);
};

export const completeInstall = async (installConfig: AgentInstallConfig): Promise<void> => {
	// Add final settings to graylogAgentValues
	const graylogAgentValues = installConfig.gatewayConfig as GraylogAgentValues;
	if (graylogAgentValues.namespace.isNew) {
		await helpers.createNamespace(graylogAgentValues.namespace.name, installConfig.log);
	}
	graylogAgentValues.centralConfig = installConfig.centralConfig;
	graylogAgentValues.graylogSecret = helpers.amplifyAgentsCredsSecret;
	graylogAgentValues.agentKeysSecret = helpers.amplifyAgentsKeysSecret;
	// read file content
	await helpers.createSecret(graylogAgentValues.namespace.name, helpers.amplifyAgentsKeysSecret, async () => {
		if (installConfig.centralConfig.ampcDosaInfo.isNew) {
			installConfig.log(
				chalk.yellow(
					`The secret '${helpers.amplifyAgentsKeysSecret}' will be created with the same "private_key.pem" and "public_key.pem" that was auto generated to create the Service Account.`
				)
			);
		}

		await helpers.createAmplifyAgentKeysSecret(
			graylogAgentValues.namespace.name,
			helpers.amplifyAgentsKeysSecret,
			'publicKey',
			graylogAgentValues.centralConfig.dosaAccount.publicKey,
			'privateKey',
			graylogAgentValues.centralConfig.dosaAccount.privateKey,
			installConfig.log
		);
	});
	await helpers.createSecret(graylogAgentValues.namespace.name, helpers.amplifyAgentsCredsSecret, async () => {
		await createGraylogCredsSecret(
			graylogAgentValues.namespace.name,
			helpers.amplifyAgentsCredsSecret,
			graylogAgentValues.userName,
			graylogAgentValues.password,
			installConfig.log
		);
	});
	graylogAgentValues.traceabilityConfig = installConfig.traceabilityConfig;

	installConfig.log('Generating the configuration file(s)...');
	writeTemplates(ConfigFiles.helmOverride, graylogAgentValues, helpers.graylogHelmOverrideTemplate);

	generateSuccessHelpMsg(graylogAgentValues.namespace.name, installConfig.log);
};

const createGraylogCredsSecret = async (
	namespace: string,
	secretName: string,
	user: string,
	password: string,
	log: (text: string) => void = () => {}
): Promise<void> => {
	const { error } = await kubectl.create(
		'secret',
		`-n ${namespace} generic ${secretName} \
		--from-literal=username=${user} \
		--from-literal=password=${password}`
	);
	if (error) {
		throw Error(error);
	}
	log(`Created ${secretName} in the ${namespace} namespace.`);
};

export const GraylogInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	AgentNameMap: {
		[AgentTypes.ca]: AgentNames.GRAYLOG_CA,
	},
	GatewayDisplay: GatewayTypes.GRAYLOG,
};

