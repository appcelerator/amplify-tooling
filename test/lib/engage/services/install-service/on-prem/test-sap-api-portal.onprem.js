import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(__dirname, '../../../../../../dist');
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const UTILS_MODULE = `${distRoot}/lib/engage/utils/utils.js`;
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/sapApiPortalAgents.js`;

describe('SAP API Portal on-prem agent flow', () => {
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

	describe('SAPAPIPortalInstallMethods metadata', () => {
		it('exports install methods with required hooks', () => {
			const methods = flowModule.SAPAPIPortalInstallMethods;
			expect(methods).to.exist;
			expect(methods.GetBundleType).to.be.a('function');
			expect(methods.GetDeploymentType).to.be.a('function');
			expect(methods.AskGatewayQuestions).to.be.a('function');
			expect(methods.FinalizeGatewayInstall).to.be.a('function');
			expect(methods.ConfigFiles).to.be.an('array').that.is.not.empty;
			expect(methods.GatewayDisplay).to.be.a('string').and.not.empty;
		});

		it('prompts bundle type and returns dockerized config type', async () => {
			td.when(promptStubs.askList(td.matchers.anything())).thenResolve('All Agents');

			const bundleType = await flowModule.askBundleType();
			const configType = await flowModule.askConfigType();

			expect(bundleType).to.equal('All Agents');
			expect(configType).to.exist;
		});
	});

	describe('AskGatewayQuestions', () => {
		it('collects common and discovery prompts when DA is enabled', async () => {
			const askInputResponses = [
				'https://sap.token.url',
				'https://sap-api.example.com',
				'api-client-id',
				'api-client-secret',
				'https://sap-dev.example.com',
				'dev-client-id',
				'dev-client-secret',
				'dev@example.com',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());
			td.when(promptStubs.askList(td.matchers.anything())).thenResolve('Yes');

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true, isTaEnabled: true }));

			expect(result.authTokenURL).to.equal('https://sap.token.url');
			expect(result.authAPIPortalBaseURL).to.equal('https://sap-api.example.com');
			expect(result.authDevPortalBaseURL).to.equal('https://sap-dev.example.com');
			expect(result.developerEmail).to.equal('dev@example.com');
			expect(result.specCreateUnstructuredAPI).to.equal(true);
		});

		it('collects only common prompts when DA is disabled', async () => {
			const askInputResponses = [
				'https://sap.token.url',
				'https://sap-api.example.com',
				'api-client-id',
				'api-client-secret',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: false, isTaEnabled: true }));

			expect(result.authTokenURL).to.equal('https://sap.token.url');
			expect(result.authAPIPortalClientID).to.equal('api-client-id');
			expect(result.authDevPortalBaseURL).to.equal('');
			expect(td.explain(promptStubs.askList).callCount).to.equal(0);
		});

		it('stops prompting when SAP API Portal discovery credential collection fails', async () => {
			const askInputResponses = [
				'https://sap.token.url',
				'https://sap-api.example.com',
				'api-client-id',
				'api-client-secret',
				'https://sap-dev.example.com',
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
			expect(td.explain(promptStubs.askInput).callCount).to.equal(6);
		});
	});

	describe('FinalizeGatewayInstall', () => {
		it('writes DA and TA templates when both are enabled', async () => {
			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: true });
			installConfig.gatewayConfig = {};

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(2);
			const files = td.explain(utilsStubs.writeTemplates).calls.map((call) => call.args[0]);
			expect(files).to.include(flowModule.ConfigFiles.DAEnvVars);
			expect(files).to.include(flowModule.ConfigFiles.TAEnvVars);
		});

		it('writes only TA template when DA is disabled', async () => {
			const installConfig = buildInstallConfig({ isDaEnabled: false, isTaEnabled: true });
			installConfig.gatewayConfig = {};

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeTemplates).calls[0].args[0]).to.equal(flowModule.ConfigFiles.TAEnvVars);
		});

		it('stops finalize when SAP API Portal template generation fails', async () => {
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

function buildInstallConfig({ isDaEnabled = true, isTaEnabled = true } = {}) {
	return {
		log: () => {},
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
