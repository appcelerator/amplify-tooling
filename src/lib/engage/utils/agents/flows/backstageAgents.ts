import { AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BasePaths, BundleType, GatewayTypes, InstallationFlowMethods, PublicDockerRepoBaseUrl, svcAccMsg } from '../../../types.js';
import { askInput, askList } from '../../basic-prompts.js';
import { AuthMode, BackstageAgentValues, backstageDAEnvVarTemplate, UrlScheme } from '../templates/backstageTemplates.js';
import * as helpers from '../index.js';
import chalk from 'chalk';
import { isWindows, writeTemplates } from '../../utils.js';

const daImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.BACKSTAGE_DA}`;

export const defaultLogFiles = '/group-*_instance-*.log';

// ConfigFiles - all the config file that are used in the setup
export const ConfigFiles = {
	DAEnvVars: `${helpers.configFiles.DA_ENV_VARS}`,
	BackstageDABinaryFile: 'discovery_agent',
	BackstageDAYaml: 'discovery_agent.yml',
};

const BackstagePrompts = {
	enterUrlHost: 'Enter the host of the URL for connecting to Backstage',
	selectUrlScheme: 'Select the scheme of the URL for connecting to Backstage',
	enterBackendPort: '(Optional) Enter the backend port of the URL for connecting to Backstage',
	enterUrlPath: '(Optional) Enter the path of the URL for connecting to Backstage',

	selectAuthMode: 'Select the authentication type for connecting to Backstage',
	enterStaticTokenValue: 'Enter the static token value',
	enterJwksClientID: 'Enter the ClientID for the JWKS Auth Flow',
	enterJwksClientSecret: 'Enter the ClientSecret for the JWKS Auth Flow',
	enterJwksTokenURL: 'Enter TokenURL for the JWKS Auth Flow',
};

export const askBundleType = async (): Promise<BundleType> => {
	// Backstage agent has only DA
	return BundleType.DISCOVERY;
};

export const askConfigType = async (): Promise<AgentConfigTypes> => {
	return AgentConfigTypes.DOCKERIZED;
};

//
// Questions for the configuration of Backstage agent
//
const askBackstageUrlHost = async (): Promise<string> =>
	(await askInput({
		msg: BackstagePrompts.enterUrlHost
	})) as string;

const askBackstageUrlScheme = async (): Promise<UrlScheme> =>
	(await askList({
		msg: BackstagePrompts.selectUrlScheme,
		choices: [ UrlScheme.HTTP, UrlScheme.HTTPS ],
	})) as UrlScheme;

const askBackstageUrlBackendPort = async (): Promise<number> =>
	(await askInput({
		msg: BackstagePrompts.enterBackendPort,
		allowEmptyInput: true,
	})) as number;

const askBackstageUrlPath = async (): Promise<string> =>
	(await askInput({
		msg: BackstagePrompts.enterUrlPath,
		allowEmptyInput: true,
	})) as string;

const askBackstageAuthMode = async (): Promise<AuthMode> =>
	(await askList({
		msg: BackstagePrompts.selectAuthMode,
		choices: [
			{ name: 'No auth',
				value: AuthMode.NoAuth,
			}, AuthMode.Guest, AuthMode.StaticToken, AuthMode.Jwks ],
	})) as AuthMode;

const askBackstageAuthStaticToken = async (): Promise<string> =>
	(await askInput({
		msg: BackstagePrompts.enterStaticTokenValue,
	})) as string;

const askBaskstageAuthJwksClientID = async (): Promise<string> =>
	(await askInput({
		msg: BackstagePrompts.enterJwksClientID,
	})) as string;

const askBaskstageAuthJwksClientSecret = async (): Promise<string> =>
	(await askInput({
		msg: BackstagePrompts.enterJwksClientSecret,
	})) as string;

const askBaskstageAuthJwksTokenUrl = async (): Promise<string> =>
	(await askInput({
		msg: BackstagePrompts.enterJwksTokenURL,
	})) as string;

export const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<BackstageAgentValues> => {
	const backstageAgentValues: BackstageAgentValues = new BackstageAgentValues();
	installConfig.log('\nCONNECTION TO Backstage:');
	installConfig.log(
		chalk.gray(
			'The discovery agent needs to connect to Backstage to discover API\'s for publishing to Amplify.'
		)
	);

	await askPrompts(backstageAgentValues);

	return backstageAgentValues;
};

const generateSuccessHelpMsg = (installConfig: AgentInstallConfig) => {
	installConfig.log(chalk.yellow(svcAccMsg));

	dockerSuccessMsg(installConfig);

	installConfig.log(
		chalk.gray(`\nAdditional information about agent features can be found here:\n${helpers.agentsDocsUrl.BACKSTAGE}`)
	);
};

const dockerSuccessMsg = (installConfig: AgentInstallConfig) => {
	const runDaLinuxMsg = `docker run -it --env-file ${helpers.pwd}/${helpers.configFiles.DA_ENV_VARS} -v ${helpers.pwd}:/keys ${helpers.eolChar}`;
	const runDaWinMsg = `docker run -it --env-file ${helpers.pwdWin}/${helpers.configFiles.DA_ENV_VARS} -v ${helpers.pwdWin}:/keys ${helpers.eolCharWin}`;
	const startDaLinuxMsg = '\nStart the Discovery Agent on a Linux based machine';
	const startDaWinMsg = '\nStart the Discovery Agent on a Windows machine';

	const dockerInfo = `To utilize the agents, pull the latest Docker images and run them using the appropriate supplied environment files, (${helpers.configFiles.DA_ENV_VARS}:`;
	installConfig.log(chalk.whiteBright(dockerInfo) + '\n');

	const daImageVersion = `${daImage}:${installConfig.daVersion}`;
	installConfig.log(chalk.white('Pull the latest image of the Discovery Agent:'));
	installConfig.log(chalk.cyan(`docker pull ${daImageVersion}`));
	installConfig.log(chalk.white(isWindows ? startDaWinMsg : startDaLinuxMsg));
	installConfig.log(chalk.cyan(isWindows ? runDaWinMsg : runDaLinuxMsg));
	installConfig.log('\t' + chalk.cyan(`-v /data ${daImageVersion}`) + '\n');
};

async function askPrompts(values: BackstageAgentValues) {
	values.host = await askBackstageUrlHost();
	values.scheme = await askBackstageUrlScheme();
	values.backendPort = await askBackstageUrlBackendPort();
	values.urlPath = await askBackstageUrlPath();

	values.authMode = await askBackstageAuthMode();
	switch (values.authMode) {
		case AuthMode.StaticToken: {
			values.staticTokenValue = await askBackstageAuthStaticToken();
			break;
		}
		case AuthMode.Jwks: {
			values.jwksClientID = await askBaskstageAuthJwksClientID();
			values.jwksClientSecret = await askBaskstageAuthJwksClientSecret();
			values.jwksTokenURL = await askBaskstageAuthJwksTokenUrl();
			break;
		}
	}

	return values;
}

export const completeInstall = async (installConfig: AgentInstallConfig): Promise<void> => {
	/**
	 * Create agent resources
	 */
	const backstageAgentValues = installConfig.gatewayConfig as BackstageAgentValues;

	// Add final settings
	backstageAgentValues.centralConfig = installConfig.centralConfig;

	installConfig.log('Generating the configuration file(s)...');
	writeTemplates(ConfigFiles.DAEnvVars, backstageAgentValues, backstageDAEnvVarTemplate);
	installConfig.log('Configuration file(s) have been successfully created.\n');

	generateSuccessHelpMsg(installConfig);
};

export const BackstageInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	AgentNameMap: {
		[AgentTypes.da]: AgentNames.BACKSTAGE_DA,
		[AgentTypes.ta]: AgentNames.BACKSTAGE_DA,
	},
	GatewayDisplay: GatewayTypes.BACKSTAGE,
};
