import chalk from 'chalk';
import { AgentConfigTypes, AgentInstallConfig, AgentNames, BasePaths, BundleType, GatewayTypes, InstallationFlowMethods, PublicDockerRepoBaseUrl, YesNo, YesNoChoices } from '../../../types.js';
import { askInput, askList, validateRegex } from '../../basic-prompts.js';
import { dockerLoginInfo, isWindows, writeTemplates } from '../../utils.js';
import { GitLabAgentValues } from '../index.js';
import * as helpers from '../index.js';

const daImage = `${PublicDockerRepoBaseUrl}${BasePaths.DockerAgentPublicRepo}/${AgentNames.GITLAB_DA}`;

// ConfigFiles - all the config file that are used in the setup
export const ConfigFiles = {
	DAEnvVars: `${helpers.configFiles.DA_ENV_VARS}`,
};

export const gitLabPrompts = {
	ACCESS_TOKEN: 'Enter the GitLab Access Token the agent will use',
	BASE_URL: 'Enter the GitLab base URL that the agent will use',
	REPOSITORY_ID: 'Enter the GitLab Repository ID the agent will use',
	REPOSITORY_BRANCH: 'Enter the Repository Branch the agent will use',
	PATHS: 'Enter a Path within the repository that the agent will use',
	FILTERS: 'Enter a filter that the agent will use (Optional)',
	DA_FREQUENCY: 'How often should the discovery run, leave blank for integrating in CI/CD process',
	QUEUE: 'Do you want to discover immediately after installation',
	ENTER_MORE_PATHS: 'Do you want to enter another path ?',
	ENTER_MORE_FILTERS: 'Do you want to enter another filter ?',
};

export const askBundleType = async (): Promise<BundleType> => {
	return BundleType.DISCOVERY;
};

export const askConfigType = async (): Promise<AgentConfigTypes> => {
	return AgentConfigTypes.DOCKERIZED;
};

// Questions for the gitLab configuration
const askForGitLabToken = async (): Promise<string> =>
	(await askInput({
		msg: gitLabPrompts.ACCESS_TOKEN,
		validate: validateRegex(
			helpers.GitLabRegexPatterns.gitLabAccessTokenRegex,
			helpers.invalidValueExampleErrMsg('AccessToken', 'mockToken')
		),
	})) as string;

const askForGitLabBaseURL = async (): Promise<string> =>
	(await askInput({
		msg: gitLabPrompts.BASE_URL,
		validate: validateRegex(
			helpers.GitLabRegexPatterns.gitLabBaseURLRegex,
			helpers.invalidValueExampleErrMsg('BaseURL', 'https://www.testdomain.com')
		),
	})) as string;

const askForGitLabRepositoryID = async (): Promise<string> =>
	(await askInput({
		msg: gitLabPrompts.REPOSITORY_ID,
		validate: validateRegex(
			helpers.GitLabRegexPatterns.gitHubRepositoryIDRegex,
			helpers.invalidValueExampleErrMsg('RepositoryID', '12312')
		),
	})) as string;

const askForGitLabRepositoryBranch = async (): Promise<string> =>
	(await askInput({
		msg: gitLabPrompts.REPOSITORY_BRANCH
	})) as string;

const askForGitLabPaths = async (log: (text: string) => void = () => {}): Promise<string[]> => {
	let askPaths = true;
	const paths = [];
	log(chalk.gray('An array of paths within the repository that the agent will gather files for looking for specs'));
	while (askPaths) {
		const path = (await askInput({
			msg: gitLabPrompts.PATHS,
			allowEmptyInput: false,
			validate: validateRegex(
				helpers.GitLabRegexPatterns.gitLabPathRegex,
				helpers.invalidValueExampleErrMsg('File Path', '/apis')
			),
		})) as string;

		paths.push(path);

		askPaths = await askList({
			msg: gitLabPrompts.ENTER_MORE_PATHS,
			default: YesNo.No,
			choices: YesNoChoices,
		}) === YesNo.Yes;
	}
	return paths;
};

const askForGitLabFilters = async (log: (text: string) => void = () => {}): Promise<string[]> => {
	let askFilters = true;
	const filters = [];
	log(chalk.gray('An array of regular expressions that a file name must match to be discovered'));
	while (askFilters) {
		const filter = (await askInput({
			msg: gitLabPrompts.FILTERS,
			allowEmptyInput: true,
		})) as string;

		if (filter.trim() !== '') {
			filters.push(filter);
			askFilters = await askList({
				msg: gitLabPrompts.ENTER_MORE_FILTERS,
				default: YesNo.No,
				choices: YesNoChoices,
			}) === YesNo.Yes;
		} else {
			askFilters = false;
		}
	}

	return filters;
};

export const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<GitLabAgentValues> => {
	const gitLabAgentValues: GitLabAgentValues = new GitLabAgentValues();
	if (installConfig.switches.isDockerInstall) {
		installConfig.log('\nCONNECTION TO GitHub API GATEWAY:');
		installConfig.log(
			chalk.gray('The Discovery Agent needs to connect to the GitHub API Gateway to discover API\'s for publishing to Amplify Engage.')
		);

		gitLabAgentValues.token = await askForGitLabToken();
		gitLabAgentValues.baseURL = await askForGitLabBaseURL();
		gitLabAgentValues.repositoryID = await askForGitLabRepositoryID();
		gitLabAgentValues.repositoryBranch = await askForGitLabRepositoryBranch();
		gitLabAgentValues.paths = await askForGitLabPaths(installConfig.log);
		gitLabAgentValues.filters = await askForGitLabFilters(installConfig.log);
	}
	return gitLabAgentValues;
};

const dockerSuccessMsg = (installConfig: AgentInstallConfig) => {
	let dockerInfo;
	const runDaLinuxMsg = `docker run -it --env-file ${helpers.pwd}/${helpers.configFiles.DA_ENV_VARS} -v ${helpers.pwd}:/keys ${helpers.eolChar}`;
	const runDaWinMsg = `docker run -it --env-file ${helpers.pwdWin}/${helpers.configFiles.DA_ENV_VARS} -v ${helpers.pwdWin}:/keys ${helpers.eolCharWin}`;
	const startDaLinuxMsg = '\nStart the Discovery Agent on a Linux based machine';
	const startDaWinMsg = '\nStart the Discovery Agent on a Windows machine';

	if (installConfig.switches.isDaEnabled) {
		dockerInfo = `To utilize the discovery agent, pull the latest Docker image and run it using the supplied environment file, (${helpers.configFiles.DA_ENV_VARS}):`;
	}
	installConfig.log(chalk.whiteBright(dockerInfo) + '\n');
	dockerLoginInfo();

	if (installConfig.switches.isDaEnabled) {
		const daImageVersion = `${daImage}:${installConfig.daVersion}`;
		installConfig.log(chalk.white('Pull the latest image of the Discovery Agent:'));
		installConfig.log(chalk.cyan(`docker pull ${daImageVersion}`));
		installConfig.log(chalk.white(isWindows ? startDaWinMsg : startDaLinuxMsg));
		installConfig.log(chalk.cyan(isWindows ? runDaWinMsg : runDaLinuxMsg));
		installConfig.log('\t' + chalk.cyan(`-v /data ${daImageVersion}`));
	}
};

const generateSuccessHelpMsg = (installConfig: AgentInstallConfig) => {
	const configType = installConfig.deploymentType;

	if (configType === AgentConfigTypes.DOCKERIZED) {
		dockerSuccessMsg(installConfig);
	}
};

export const installPreprocess = async (installConfig: AgentInstallConfig): Promise<AgentInstallConfig> => {

	return installConfig;
};

export const completeInstall = async (installConfig: AgentInstallConfig): Promise<void> => {
	/**
	 * Create agent resources
	 */
	const gitLabAgentValues = installConfig.gatewayConfig as GitLabAgentValues;

	// Add final settings to gitLabAgentValues
	gitLabAgentValues.centralConfig = installConfig.centralConfig;
	gitLabAgentValues.daVersion = installConfig.daVersion;

	if (installConfig.switches.isDockerInstall) {
		if (installConfig.switches.isDaEnabled) {
			writeTemplates(ConfigFiles.DAEnvVars, gitLabAgentValues, helpers.gitLabDAEnvVarTemplate);
		}
	}

	installConfig.log('Configuration file(s) have been successfully created.\n');

	generateSuccessHelpMsg(installConfig);
};

export const GitLabInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	InstallPreprocess: installPreprocess,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	GatewayDisplay: GatewayTypes.GITLAB,
};
