import { expect } from 'chai';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = pathToFileURL(path.resolve(__dirname, '../../../../../../dist')).href;
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const UTILS_MODULE = `${distRoot}/lib/engage/utils/utils.js`;
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/softwareAGWebMethodAgents.js`;

describe('Software AG WebMethods on-prem agent flow', () => {
	let flowModule;
	let promptStubs;
	let utilsStubs;

	beforeEach(async () => {
		const realPrompts = await import(BASIC_PROMPTS);
		promptStubs = {
			...realPrompts,
			askInput: td.func('askInput'),
			askList: td.func('askList'),
		};
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

	describe('SoftwareAGWebMethodsInstallMethods metadata', () => {
		it('exports install methods with required hooks', () => {
			const methods = flowModule.SoftwareAGWebMethodsInstallMethods;
			expect(methods).to.exist;
			expect(methods.GetBundleType).to.be.a('function');
			expect(methods.GetDeploymentType).to.be.a('function');
			expect(methods.AskGatewayQuestions).to.be.a('function');
			expect(methods.FinalizeGatewayInstall).to.be.a('function');
			expect(methods.ConfigFiles).to.be.an('array').that.is.not.empty;
			expect(methods.GatewayDisplay).to.be.a('string').and.not.empty;
		});

		it('prompts for bundle type and returns dockerized config type', async () => {
			td.when(promptStubs.askList(td.matchers.anything())).thenResolve('All Agents');

			const bundleType = await flowModule.askBundleType();
			const configType = await flowModule.askConfigType();

			expect(bundleType).to.equal('All Agents');
			expect(configType).to.exist;
			expect(td.explain(promptStubs.askList).callCount).to.equal(1);
		});
	});

	describe('AskGatewayQuestions', () => {
		it('collects common prompts when either DA or TA is enabled', async () => {
			const askInputResponses = [
				'https://webmethods.example.com',
				'wm-user',
				'wm-pass',
				'custom-auth',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: false, isTaEnabled: true }));

			expect(result.pathURL).to.equal('https://webmethods.example.com');
			expect(result.pathUsername).to.equal('wm-user');
			expect(result.pathPassword).to.equal('wm-pass');
			expect(result.pathOauth2Server).to.equal('custom-auth');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(4);
		});

		it('defaults oauth2 server to local when prompt returns empty', async () => {
			const askInputResponses = [
				'https://webmethods.example.com',
				'wm-user',
				'wm-pass',
				'  ',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true, isTaEnabled: false }));

			expect(result.pathOauth2Server).to.equal('local');
		});

		it('skips prompts when both DA and TA are disabled', async () => {
			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: false, isTaEnabled: false }));

			expect(result.pathURL).to.equal('');
			expect(result.pathUsername).to.equal('');
			expect(result.pathPassword).to.equal('');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(0);
		});

		it('stops prompting when Software AG WebMethods credential collection fails', async () => {
			const askInputResponses = [
				'https://webmethods.example.com',
				'wm-user',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => {
				if (askInputResponses.length > 0) {
					return askInputResponses.shift();
				}
				throw new Error('credential failed');
			});

			let error;
			try {
				await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true, isTaEnabled: true }));
			} catch (err) {
				error = err;
			}

			expect(error).to.be.instanceOf(Error);
			expect(error.message).to.equal('credential failed');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(3);
		});
	});

	describe('FinalizeGatewayInstall', () => {
		it('writes DA and TA templates when both are enabled', async () => {
			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: true });
			installConfig.gatewayConfig = {
				pathURL: 'https://webmethods.example.com',
				pathUsername: 'wm-user',
				pathPassword: 'wm-pass',
				pathOauth2Server: 'local',
			};

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(2);
			const files = td.explain(utilsStubs.writeTemplates).calls.map((call) => call.args[0]);
			expect(files).to.include(flowModule.ConfigFiles.DAEnvVars);
			expect(files).to.include(flowModule.ConfigFiles.TAEnvVars);
		});

		it('writes only DA template when TA is disabled', async () => {
			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: false });
			installConfig.gatewayConfig = {};

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeTemplates).calls[0].args[0]).to.equal(flowModule.ConfigFiles.DAEnvVars);
		});

		it('writes only TA template when DA is disabled', async () => {
			const installConfig = buildInstallConfig({ isDaEnabled: false, isTaEnabled: true });
			installConfig.gatewayConfig = {};

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeTemplates).calls[0].args[0]).to.equal(flowModule.ConfigFiles.TAEnvVars);
		});

		it('logs service-account warning when dosa is new', async () => {
			const logs = [ ];
			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: false, logSink: logs });
			installConfig.centralConfig.ampcDosaInfo.isNew = true;
			installConfig.gatewayConfig = {};

			await flowModule.completeInstall(installConfig);

			expect(logs.some((line) => line.includes('private_key.pem'))).to.equal(true);
		});

		it('stops finalize when Software AG template generation fails', async () => {
			td.when(utilsStubs.writeTemplates(td.matchers.anything(), td.matchers.anything(), td.matchers.anything()))
				.thenDo(() => {
					throw new Error('write failed');
				});

			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: true });
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

function buildInstallConfig({
	isDaEnabled = true,
	isTaEnabled = true,
	logSink = null,
} = {}) {
	const logs = logSink || [ ];
	return {
		log: (msg) => logs.push(String(msg)),
		switches: {
			isDockerInstall: true,
			isHelmInstall: false,
			isHostedInstall: false,
			isDaEnabled,
			isTaEnabled,
		},
		centralConfig: {
			apiServerClient: {},
			definitionManager: {},
			ampcEnvInfo: { name: 'installed-env' },
			ampcDosaInfo: { isNew: false },
			dosaAccount: { publicKey: 'pub.pem', privateKey: 'priv.pem' },
		},
		daVersion: '1.2.3',
		taVersion: '1.2.4',
		traceabilityConfig: {},
		gatewayConfig: {},
	};
}
