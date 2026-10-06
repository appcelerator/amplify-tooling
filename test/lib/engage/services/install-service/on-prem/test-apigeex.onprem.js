import { expect } from 'chai';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = pathToFileURL(path.resolve(__dirname, '../../../../../../dist')).href;
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const AGENTS_INDEX  = `${distRoot}/lib/engage/utils/agents/index.js`;
const UTILS_MODULE = `${distRoot}/lib/engage/utils/utils.js`;
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/apigeexAgents.js`;

describe('Apigee X on-prem agent flow', () => {
	let flowModule;
	let promptStubs;
	let utilsStubs;

	beforeEach(async () => {
		promptStubs = await td.replaceEsm(BASIC_PROMPTS);
		await td.replaceEsm(AGENTS_INDEX);
		utilsStubs = await td.replaceEsm(UTILS_MODULE);

		flowModule = await import(FLOW_MODULE);
	});

	afterEach(() => td.reset());

	describe('ApigeeXInstallMethods metadata', () => {
		it('exports install methods with required hooks', () => {
			const methods = flowModule.ApigeeXInstallMethods;
			expect(methods).to.exist;
			expect(methods.GetBundleType).to.be.a('function');
			expect(methods.GetDeploymentType).to.be.a('function');
			expect(methods.AskGatewayQuestions).to.be.a('function');
			expect(methods.FinalizeGatewayInstall).to.be.a('function');
			expect(methods.ConfigFiles).to.be.an('array').that.is.not.empty;
			expect(methods.GatewayDisplay).to.be.a('string').and.not.empty;
		});

		it('returns a prompted bundle type for APIGEEX gateway', async () => {
			td.when(promptStubs.askList(td.matchers.anything())).thenResolve('bundle-choice');

			const bundleType = await flowModule.askBundleType(flowModule.ApigeeXInstallMethods.GatewayDisplay);
			expect(bundleType).to.equal('bundle-choice');
			expect(td.explain(promptStubs.askList).callCount).to.equal(1);
		});

		it('returns discovery bundle type when gateway is not APIGEEX', async () => {
			const bundleType = await flowModule.askBundleType();
			expect(bundleType).to.exist;
			expect(td.explain(promptStubs.askList).callCount).to.equal(0);
		});

		it('always returns dockerized config type', async () => {
			const deploymentType = await flowModule.askConfigType();
			expect(deploymentType).to.exist;
			expect(td.explain(promptStubs.askList).callCount).to.equal(0);
		});
	});

	describe('AskGatewayQuestions', () => {
		it('collects DA prompts when discovery is enabled and metrics filtering is disabled', async () => {
			const askInputResponses = [
				'rd-amplify-apigee-x',
				'dev@axway.com',
				'auth.json',
				'test-env',
			];
			td.when(promptStubs.askInput(td.matchers.anything()))
				.thenDo(() => askInputResponses.shift());

			td.when(promptStubs.askList(td.matchers.anything()))
				.thenResolve('No');

			const result = await flowModule.gatewayConnectivity(
				buildInstallConfig({ isDaEnabled: true, isTaEnabled: false })
			);

			expect(result.projectId).to.equal('rd-amplify-apigee-x');
			expect(result.developerEmailAddress).to.equal('dev@axway.com');
			expect(result.fileName).to.equal('auth.json');
			expect(result.environment).to.equal('test-env');
			expect(result.metricsFilter.filterMetrics).to.equal(false);
			expect(result.metricsFilter.filteredAPIs).to.deep.equal([ ]);
			expect(td.explain(promptStubs.askInput).callCount).to.equal(4);
			expect(td.explain(promptStubs.askList).callCount).to.equal(1);
		});

		it('collects metrics filter API loop when discovery filtering is enabled', async () => {
			const askInputResponses = [
				'rd-amplify-apigee-x',
				'dev@axway.com',
				'auth.json',
				'',
				'payments-api',
				'orders-api',
			];
			td.when(promptStubs.askInput(td.matchers.anything()))
				.thenDo(() => askInputResponses.shift());

			const askListResponses = [
				'Yes',
				'Yes',
				'No',
			];
			td.when(promptStubs.askList(td.matchers.anything()))
				.thenDo(() => askListResponses.shift());

			const result = await flowModule.gatewayConnectivity(
				buildInstallConfig({ isDaEnabled: true, isTaEnabled: false })
			);

			expect(result.metricsFilter.filterMetrics).to.equal(true);
			expect(result.metricsFilter.filteredAPIs).to.deep.equal([ 'payments-api', 'orders-api' ]);
			expect(td.explain(promptStubs.askInput).callCount).to.equal(6);
			expect(td.explain(promptStubs.askList).callCount).to.equal(3);
		});

		it('collects only TA metrics prompts when only traceability is enabled', async () => {
			const askInputResponses = [ 'billing-api' ];
			td.when(promptStubs.askInput(td.matchers.anything()))
				.thenDo(() => askInputResponses.shift());

			const askListResponses = [ 'Yes', 'No' ];
			td.when(promptStubs.askList(td.matchers.anything()))
				.thenDo(() => askListResponses.shift());

			const result = await flowModule.gatewayConnectivity(
				buildInstallConfig({ isDaEnabled: false, isTaEnabled: true })
			);

			expect(result.metricsFilter.filterMetrics).to.equal(true);
			expect(result.metricsFilter.filteredAPIs).to.deep.equal([ 'billing-api' ]);
			expect(td.explain(promptStubs.askInput).callCount).to.equal(1);
			expect(td.explain(promptStubs.askList).callCount).to.equal(2);
		});

		it('wires the Apigee X project ID validator into the discovery prompt', async () => {
			const validator = () => true;
			td.when(promptStubs.validateRegex(td.matchers.anything(), td.matchers.anything())).thenReturn(validator);

			const promptConfigs = [ ];
			const askInputResponses = [
				'rd-amplify-apigee-x',
				'dev@axway.com',
				'auth.json',
				'test-env',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo((config) => {
				promptConfigs.push(config);
				return askInputResponses.shift();
			});
			td.when(promptStubs.askList(td.matchers.anything())).thenResolve('No');

			await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true, isTaEnabled: false }));

			expect(promptConfigs.find((config) => config.msg === 'Enter the APIGEE X Project ID the agent will use').validate).to.equal(validator);
			expect(td.explain(promptStubs.validateRegex).callCount).to.equal(1);
		});
	});

	describe('FinalizeGatewayInstall', () => {
		it('writes only DA template when DA is enabled and TA is disabled', async () => {
			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: false, isDockerInstall: true });
			installConfig.gatewayConfig = {
				projectId: 'rd-amplify-apigee-x',
				developerEmailAddress: 'dev@axway.com',
				fileName: 'auth.json',
				environment: 'test-env',
			};

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeTemplates).calls[0].args[0]).to.equal(flowModule.ConfigFiles.DAEnvVars);
		});

		it('writes both DA and TA templates when both bundles are enabled', async () => {
			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: true, isDockerInstall: true });
			installConfig.daVersion = '1.0.0';
			installConfig.taVersion = '1.0.1';
			installConfig.gatewayConfig = {
				projectId: 'rd-amplify-apigee-x',
				developerEmailAddress: 'dev@axway.com',
				fileName: 'auth.json',
				environment: 'test-env',
			};

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(2);
			const writeArgs = td.explain(utilsStubs.writeTemplates).calls.map((c) => c.args[0]);
			expect(writeArgs).to.include(flowModule.ConfigFiles.DAEnvVars);
			expect(writeArgs).to.include(flowModule.ConfigFiles.TAEnvVars);
		});

		it('logs service-account copy warning for new dosa in non-helm installs', async () => {
			const logs = [ ];
			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: false, isDockerInstall: true });
			installConfig.log = (msg) => logs.push(String(msg));
			installConfig.centralConfig.ampcDosaInfo.isNew = true;
			installConfig.gatewayConfig = {
				projectId: 'rd-amplify-apigee-x',
				developerEmailAddress: 'dev@axway.com',
				fileName: 'auth.json',
				environment: 'test-env',
			};

			await flowModule.completeInstall(installConfig);

			expect(logs.some((line) => line.includes('private_key.pem'))).to.equal(true);
		});

		it('stops finalize when Apigee X template generation fails', async () => {
			td.when(utilsStubs.writeTemplates(td.matchers.anything(), td.matchers.anything(), td.matchers.anything()))
				.thenDo(() => {
					throw new Error('write failed');
				});

			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: true, isDockerInstall: true });
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
	isDockerInstall = false,
	isHelmInstall = false,
	isDaEnabled = true,
	isTaEnabled = true,
} = {}) {
	return {
		log: () => {},
		switches: {
			isDockerInstall,
			isHelmInstall,
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
		deploymentType: 'DOCKERIZED',
		daVersion: '1.2.3',
		taVersion: '1.2.4',
		traceabilityConfig: {},
		gatewayConfig: {},
	};
}
