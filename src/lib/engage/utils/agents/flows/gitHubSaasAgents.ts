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

const { log } = logger('engage: install: agents: saas');

class GitHubDataplaneConfig extends DataplaneConfig {
	name: string;
	ownerName: string;
	filter: GitHubFilterConfig;

	constructor(name: string, ownerName: string, filter: GitHubFilterConfig) {
		super('GitHub');
		this.name = name;
		this.ownerName = ownerName;
		this.filter = filter;
	}
}

class GitHubFilterConfig {
	paths: string[];
	branch: string;
	pattern: string[];

	constructor(paths: string[], branch: string, pattern: string[]) {
		this.paths = paths;
		this.branch = branch;
		this.pattern = pattern;
	}
}

class SaasAgentValues {
	frequencyDA: string;
	queueDA: boolean;
	frequencyTA: string;
	dataplaneConfig: DataplaneConfig;
	centralConfig: CentralAgentConfig;
	repositoryOwner: string;
	repositoryName: string;
	repositoryBranch: string;
	filePaths: string[];
	filePatterns: string[];

	constructor() {
		this.frequencyDA = '';
		this.queueDA = false;
		this.frequencyTA = '';
		this.dataplaneConfig = new DataplaneConfig();
		this.centralConfig = new CentralAgentConfig();
		this.repositoryOwner = '';
		this.repositoryName = '';
		this.repositoryBranch = '';
		this.filePaths = [];
		this.filePatterns = [];
	}
}

class SaasGitHubAgentValues extends SaasAgentValues {
	accessToken: string;

	constructor() {
		super();
		this.accessToken = '';
	}

	getAccessData() {
		const data = JSON.stringify({
			accessToken: this.accessToken
		});

		return data;
	}
}

// GitHub SaaSPrompts - all GitHub Saas prompts to the user for input
const SaasPrompts = {
	ACCESS_TOKEN: 'Enter the GitHub Access Token the agent will use',
	REPOSITORY_OWNER: 'Enter the GitHub Repository Owner the agent will use',
	REPOSITORY_NAME: 'Enter the Repository Name the agent will use',
	REPOSITORY_BRANCH: 'Enter the Repository Branch the agent will use',
	FILE_PATHS: 'Enter a File Path within the repository that the agent will use',
	FILE_PATTERNS: 'Enter a File Pattern that the agent will use (Optional)',
	DA_FREQUENCY: 'How often should the discovery run, leave blank for integrating in CI/CD process',
	QUEUE: 'Do you want to discover immediately after installation',
	ENTER_MORE_PATHS: 'Do you want to enter another file path ?',
	ENTER_MORE_PATTERNS: 'Do you want to enter another file pattern ?',
};

export const askBundleType = async (): Promise<BundleType> => {
	// GitHub agent has only DA
	return BundleType.DISCOVERY;
};

const askConfigType = async (): Promise<AgentConfigTypes> => {
	return AgentConfigTypes.HOSTED;
};

const askForGitHubCredentials = async (hostedAgentValues: SaasGitHubAgentValues): Promise<SaasAgentValues> => {
	log('gathering access details for GitHub');

	hostedAgentValues.accessToken = (await askInput({
		msg: SaasPrompts.ACCESS_TOKEN,
		defaultValue: hostedAgentValues.accessToken !== '' ? hostedAgentValues.accessToken : undefined,
		validate: validateRegex(
			helpers.GitHubRegexPatterns.gitHubAccessTokenRegex,
			helpers.invalidValueExampleErrMsg('AccessToken', 'ghp_testTokentestTokentestTokentestToken')
		),
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
	console.log('\nCONNECTION TO GitHub API GATEWAY:');
	console.log(
		chalk.gray('The Discovery Agent needs to connect to the GitHub API Gateway to discover API\'s for publishing to Amplify Engage')
	);

	// DeploymentType
	let hostedAgentValues: SaasAgentValues = new SaasAgentValues();

	if (installConfig.gatewayType === SaaSGatewayTypes.GITHUB) {
		// GitHub connection details
		hostedAgentValues = new SaasGitHubAgentValues();
		hostedAgentValues = await askForGitHubCredentials(hostedAgentValues as SaasGitHubAgentValues);
	}

	// Ask to queue discovery now
	log('getting the frequency and if the agent should run now');
	console.log(
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

	// get repository owner
	hostedAgentValues.repositoryOwner = (await askInput({
		msg: SaasPrompts.REPOSITORY_OWNER,
		defaultValue: hostedAgentValues.repositoryOwner !== '' ? hostedAgentValues.repositoryOwner : undefined,
		validate: validateRegex(
			helpers.GitHubRegexPatterns.gitHubRepositoryOwnerRegex,
			helpers.invalidValueExampleErrMsg('Repository Owner', 'axway-github-owner')
		),
	})) as string;

	// get repository name
	hostedAgentValues.repositoryName = (await askInput({
		msg: SaasPrompts.REPOSITORY_NAME,
		defaultValue: hostedAgentValues.repositoryName !== '' ? hostedAgentValues.repositoryName : undefined,
		validate: validateRegex(
			helpers.GitHubRegexPatterns.gitHubRepositoryNameRegex,
			helpers.invalidValueExampleErrMsg('Repository Name', 'axway-github-repo-name')
		),
	})) as string;

	// get repository branch
	hostedAgentValues.repositoryBranch = (await askInput({
		msg: SaasPrompts.REPOSITORY_BRANCH,
		defaultValue: hostedAgentValues.repositoryBranch !== '' ? hostedAgentValues.repositoryBranch : undefined
	})) as string;

	// get File Paths

	let askFilePaths = true;
	console.log(chalk.gray('An array of paths within the repository that the agent will gather files for looking for specs'));
	while (askFilePaths) {
		const path = (await askInput({
			msg: SaasPrompts.FILE_PATHS,
			allowEmptyInput: false,
			validate: validateRegex(
				helpers.GitHubRegexPatterns.gitHubFilePathRegex,
				helpers.invalidValueExampleErrMsg('File Path', '/apis')
			),
		})) as string;

		hostedAgentValues.filePaths.push(path);

		askFilePaths = await askList({
			msg: SaasPrompts.ENTER_MORE_PATHS,
			default: YesNo.No,
			choices: YesNoChoices,
		}) === YesNo.Yes;
	}

	// get File Patterns

	let askFilePatterns = true;
	console.log(chalk.gray('An array of regular expressions that a file name must match to be discovered'));
	while (askFilePatterns) {
		const pattern = (await askInput({
			msg: SaasPrompts.FILE_PATTERNS,
			allowEmptyInput: true,
		})) as string;

		if (pattern.trim() !== '') {

			hostedAgentValues.filePatterns.push(pattern);

			askFilePatterns = await askList({
				msg: SaasPrompts.ENTER_MORE_PATTERNS,
				default: YesNo.No,
				choices: YesNoChoices,
			}) === YesNo.Yes;
		} else {
			askFilePatterns = false;
		}
	}

	return hostedAgentValues;
};

const generateOutput = async (installConfig: AgentInstallConfig): Promise<string> => {
	return `Install complete of hosted agent for ${installConfig.gatewayType} region`;
};

const createEncryptedAccessData = async (hostedAgentValues: SaasGitHubAgentValues, dataplaneRes: GenericResource): Promise<string> => {
	// grab key from data plane resource
	const key = dataplaneRes.security?.encryptionKey  || '';
	const hash = dataplaneRes.security?.encryptionHash || '';

	if (key === '' || hash === '') {
		throw Error('cannot encrypt access data as the encryption key info was incomplete');
	}
	console.log(hostedAgentValues.getAccessData());
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
	console.log('\n');
	const gitHubAgentValues = installConfig.gatewayConfig as SaasGitHubAgentValues;

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

	if (installConfig.gatewayType === SaaSGatewayTypes.GITHUB) {
		gitHubAgentValues.dataplaneConfig
			= new GitHubDataplaneConfig((gitHubAgentValues as SaasGitHubAgentValues).repositoryName,
				(gitHubAgentValues as SaasGitHubAgentValues).repositoryOwner, new GitHubFilterConfig((gitHubAgentValues as SaasGitHubAgentValues).filePaths,
					(gitHubAgentValues as SaasGitHubAgentValues).repositoryBranch, (gitHubAgentValues as SaasGitHubAgentValues).filePatterns));
	}

	// create the data plane resource
	const dataplaneRes = await helpers.createNewDataPlaneResource(
		apiServerClient as ApiServerClient,
		defsManager as DefinitionsManager,
		installConfig.centralConfig.environment,
		GatewayTypeToDataPlane[installConfig.gatewayType],
		gitHubAgentValues.dataplaneConfig,
	);
	// create data plane secret resource
	try {
		await helpers.createNewDataPlaneSecretResource(
			apiServerClient as ApiServerClient,
			defsManager as DefinitionsManager,
			installConfig.centralConfig.environment,
			GatewayTypeToDataPlane[installConfig.gatewayType],
			dataplaneRes.name,
			await createEncryptedAccessData(gitHubAgentValues, dataplaneRes),
		);
	} catch (_error) {
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

	// create discovery agent resource
	installConfig.centralConfig.daAgentName = await helpers.createNewAgentResource(
		apiServerClient as ApiServerClient,
		defsManager as DefinitionsManager,
		installConfig.centralConfig.environment,
		GatewayTypeToDataPlane[installConfig.gatewayType as SaaSGatewayTypes],
		AgentResourceKind.da,
		AgentTypes.da,
		installConfig.centralConfig.ampcTeamName,
		GatewayTypeToDataPlane[installConfig.gatewayType as SaaSGatewayTypes] + ' Discovery Agent',
		dataplaneRes.name,
		gitHubAgentValues.frequencyDA,
		gitHubAgentValues.queueDA,
	);

	console.log(await generateOutput(installConfig));
};

export const GitHubSaaSInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: [],
	AgentNameMap: {
		[AgentTypes.da]: AgentNames.GITHUB_DA,
	},
	GatewayDisplay: SaaSGatewayTypes.GITHUB,
};
