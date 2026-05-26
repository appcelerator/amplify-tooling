import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(__dirname, '../../../../../../dist');
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const UTILS_MODULE = `${distRoot}/lib/engage/utils/utils.js`;
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/gitLabAgents.js`;

describe('GitLab on-prem agent flow', () => {
	let flowModule;
	let promptStubs;
	let utilsStubs;

	beforeEach(async () => {
		const realPrompts = await import(BASIC_PROMPTS);
		promptStubs = {
			...realPrompts,
			askInput: td.func('askInput'),
			askList: td.func('askList'),
			validateRegex: td.func('validateRegex'),
		};
		td.when(promptStubs.validateRegex(td.matchers.anything(), td.matchers.anything())).thenReturn(() => true);
		await td.replaceEsm(BASIC_PROMPTS, promptStubs);

		const realUtils = await import(UTILS_MODULE);
		utilsStubs = {
			...realUtils,
			writeTemplates: td.func('writeTemplates'),
			isWindows: false,
		};
		await td.replaceEsm(UTILS_MODULE, utilsStubs);

		flowModule = await import(FLOW_MODULE);
	});

	afterEach(() => td.reset());

	describe('GitLabInstallMethods metadata', () => {
		it('exports install methods with required hooks', () => {
			const methods = flowModule.GitLabInstallMethods;
			expect(methods).to.exist;
			expect(methods.GetBundleType).to.be.a('function');
			expect(methods.GetDeploymentType).to.be.a('function');
			expect(methods.AskGatewayQuestions).to.be.a('function');
			expect(methods.InstallPreprocess).to.be.a('function');
			expect(methods.FinalizeGatewayInstall).to.be.a('function');
			expect(methods.ConfigFiles).to.be.an('array').that.is.not.empty;
			expect(methods.GatewayDisplay).to.be.a('string').and.not.empty;
		});

		it('returns static discovery bundle and dockerized config type', async () => {
			const bundleType = await flowModule.askBundleType();
			const configType = await flowModule.askConfigType();

			expect(bundleType).to.equal('Discovery');
			expect(configType).to.exist;
			expect(td.explain(promptStubs.askList).callCount).to.equal(0);
		});
	});

	describe('AskGatewayQuestions', () => {
		it('collects repository details with multi-path and multi-filter loops in docker mode', async () => {
			const askInputResponses = [
				'gitlab-token',
				'https://gitlab.example.com',
				'12345',
				'main',
				'/apis/v1',
				'/apis/v2',
				'.*openapi.*',
				'.*swagger.*',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const askListResponses = [ 'Yes', 'No', 'Yes', 'No' ];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDockerInstall: true, isDaEnabled: true }));

			expect(result.token).to.equal('gitlab-token');
			expect(result.baseURL).to.equal('https://gitlab.example.com');
			expect(result.repositoryID).to.equal('12345');
			expect(result.repositoryBranch).to.equal('main');
			expect(result.paths).to.deep.equal([ '/apis/v1', '/apis/v2' ]);
			expect(result.filters).to.deep.equal([ '.*openapi.*', '.*swagger.*' ]);
			expect(td.explain(promptStubs.askInput).callCount).to.equal(8);
			expect(td.explain(promptStubs.askList).callCount).to.equal(4);
		});

		it('stops filter collection when first filter is empty', async () => {
			const askInputResponses = [
				'gitlab-token',
				'https://gitlab.example.com',
				'12345',
				'main',
				'/apis',
				'',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const askListResponses = [ 'No' ];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDockerInstall: true, isDaEnabled: true }));

			expect(result.paths).to.deep.equal([ '/apis' ]);
			expect(result.filters).to.deep.equal([ ]);
		});

		it('skips prompts when docker mode is disabled', async () => {
			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDockerInstall: false, isDaEnabled: true }));

			expect(result.token).to.equal('');
			expect(result.baseURL).to.equal('');
			expect(result.paths).to.deep.equal([ ]);
			expect(td.explain(promptStubs.askInput).callCount).to.equal(0);
		});

		it('wires token, base URL, repository ID, and path validators into the prompt config', async () => {
			const validator = () => true;
			td.when(promptStubs.validateRegex(td.matchers.anything(), td.matchers.anything())).thenReturn(validator);

			const promptConfigs = [ ];
			const askInputResponses = [
				'gitlab-token',
				'https://gitlab.example.com',
				'12345',
				'main',
				'/apis',
				'',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo((config) => {
				promptConfigs.push(config);
				return askInputResponses.shift();
			});
			td.when(promptStubs.askList(td.matchers.anything())).thenResolve('No');

			await flowModule.gatewayConnectivity(buildInstallConfig({ isDockerInstall: true, isDaEnabled: true }));

			expect(promptConfigs.find((config) => config.msg === 'Enter the GitLab Access Token the agent will use').validate).to.equal(validator);
			expect(promptConfigs.find((config) => config.msg === 'Enter the GitLab base URL that the agent will use').validate).to.equal(validator);
			expect(promptConfigs.find((config) => config.msg === 'Enter the GitLab Repository ID the agent will use').validate).to.equal(validator);
			expect(promptConfigs.find((config) => config.msg === 'Enter a Path within the repository that the agent will use').validate).to.equal(validator);
			expect(td.explain(promptStubs.validateRegex).callCount).to.equal(4);
		});
	});

	describe('InstallPreprocess and FinalizeGatewayInstall', () => {
		it('returns installConfig unchanged in installPreprocess', async () => {
			const installConfig = buildInstallConfig({ isDockerInstall: true, isDaEnabled: true });
			const result = await flowModule.installPreprocess(installConfig);
			expect(result).to.equal(installConfig);
		});

		it('writes DA env template only for docker discovery install', async () => {
			const installConfig = buildInstallConfig({ isDockerInstall: true, isDaEnabled: true });
			installConfig.gatewayConfig = {
				token: 'gitlab-token',
				baseURL: 'https://gitlab.example.com',
				repositoryID: '12345',
				repositoryBranch: 'main',
				paths: [ '/apis' ],
				filters: [ '.*openapi.*' ],
			};

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeTemplates).calls[0].args[0]).to.equal(flowModule.ConfigFiles.DAEnvVars);
		});

		it('does not write templates when docker mode is disabled', async () => {
			const installConfig = buildInstallConfig({ isDockerInstall: false, isDaEnabled: true });
			installConfig.gatewayConfig = {};

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(0);
		});

		it('stops finalize when GitLab template generation fails', async () => {
			td.when(utilsStubs.writeTemplates(td.matchers.anything(), td.matchers.anything(), td.matchers.anything()))
				.thenDo(() => {
					throw new Error('write failed');
				});

			const installConfig = buildInstallConfig({ isDockerInstall: true, isDaEnabled: true });
			installConfig.gatewayConfig = {};

			let error;
			try {
				await flowModule.completeInstall(installConfig);
			} catch (err) {
				error = err;
			}

			expect(error).to.be.instanceOf(Error);
			expect(error.message).to.equal('write failed');
			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(1);
		});
	});
});

function buildInstallConfig({ isDockerInstall = true, isDaEnabled = true } = {}) {
	return {
		log: () => {},
		switches: {
			isDockerInstall,
			isHelmInstall: false,
			isHostedInstall: false,
			isDaEnabled,
			isTaEnabled: false,
		},
		centralConfig: {
			apiServerClient: {},
			definitionManager: {},
			ampcEnvInfo: { name: 'installed-env' },
			ampcDosaInfo: { isNew: false },
			dosaAccount: { publicKey: 'pub.pem', privateKey: 'priv.pem' },
		},
		deploymentType: 'DOCKERIZED',
		daVersion: '1.2.3',
		traceabilityConfig: {},
		gatewayConfig: {},
	};
}
