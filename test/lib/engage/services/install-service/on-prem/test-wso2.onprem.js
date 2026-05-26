import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(__dirname, '../../../../../../dist');
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const UTILS_MODULE = `${distRoot}/lib/engage/utils/utils.js`;
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/wso2Agents.js`;

describe('WSO2 on-prem agent flow', () => {
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

	describe('WSO2InstallMethods metadata', () => {
		it('exports install methods with required hooks', () => {
			const methods = flowModule.WSO2InstallMethods;
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
		it('collects discovery prompts when DA is enabled', async () => {
			const askInputResponses = [
				'https://wso2.example.com',
				'client-id',
				'client-secret',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true, isTaEnabled: true }));

			expect(result.wso2BaseURL).to.equal('https://wso2.example.com');
			expect(result.wso2ClientID).to.equal('client-id');
			expect(result.wso2ClientSecret).to.equal('client-secret');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(3);
		});

		it('skips discovery prompts when DA is disabled', async () => {
			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: false, isTaEnabled: true }));

			expect(result.wso2BaseURL).to.equal('');
			expect(result.wso2ClientID).to.equal('');
			expect(result.wso2ClientSecret).to.equal('');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(0);
		});

		it('wires the WSO2 base URL validator into the discovery prompt', async () => {
			const validator = () => true;
			td.when(promptStubs.validateRegex(td.matchers.anything(), td.matchers.anything())).thenReturn(validator);

			const promptConfigs = [ ];
			const askInputResponses = [
				'https://wso2.example.com',
				'client-id',
				'client-secret',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo((config) => {
				promptConfigs.push(config);
				return askInputResponses.shift();
			});

			await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true, isTaEnabled: true }));

			expect(promptConfigs.find((config) => config.msg === 'Enter the WSO2 baseURL').validate).to.equal(validator);
			expect(td.explain(promptStubs.validateRegex).callCount).to.equal(1);
		});
	});

	describe('FinalizeGatewayInstall', () => {
		it('writes DA and TA templates when both are enabled', async () => {
			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: true });
			installConfig.gatewayConfig = {
				wso2BaseURL: 'https://wso2.example.com',
				wso2ClientID: 'client-id',
				wso2ClientSecret: 'client-secret',
			};

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(2);
			const files = td.explain(utilsStubs.writeTemplates).calls.map((call) => call.args[0]);
			expect(files).to.include(flowModule.ConfigFiles.DAEnvVars);
			expect(files).to.include(flowModule.ConfigFiles.TAEnvVars);
		});

		it('writes only TA template and logs listener hint when DA is disabled', async () => {
			const logs = [ ];
			const installConfig = buildInstallConfig({ isDaEnabled: false, isTaEnabled: true, logSink: logs });
			installConfig.gatewayConfig = {};

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeTemplates).calls[0].args[0]).to.equal(flowModule.ConfigFiles.TAEnvVars);
			expect(logs.some((line) => line.includes('localhost:8888'))).to.equal(true);
		});

		it('logs service-account warning when dosa is new', async () => {
			const logs = [ ];
			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: false, logSink: logs });
			installConfig.centralConfig.ampcDosaInfo.isNew = true;
			installConfig.gatewayConfig = {};

			await flowModule.completeInstall(installConfig);

			expect(logs.some((line) => line.includes('private_key.pem'))).to.equal(true);
		});

		it('stops finalize when the first WSO2 template generation fails', async () => {
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
