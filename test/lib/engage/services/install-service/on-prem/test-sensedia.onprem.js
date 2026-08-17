import { expect } from 'chai';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = pathToFileURL(path.resolve(__dirname, '../../../../../../dist')).href;
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const UTILS_MODULE = `${distRoot}/lib/engage/utils/utils.js`;
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/sensediaAgents.js`;

describe('Sensedia on-prem agent flow', () => {
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

	describe('SensediaInstallMethods metadata', () => {
		it('exports install methods with required hooks', () => {
			const methods = flowModule.SensediaInstallMethods;
			expect(methods).to.exist;
			expect(methods.GetBundleType).to.be.a('function');
			expect(methods.GetDeploymentType).to.be.a('function');
			expect(methods.AskGatewayQuestions).to.be.a('function');
			expect(methods.FinalizeGatewayInstall).to.be.a('function');
			expect(methods.ConfigFiles).to.be.an('array').that.is.not.empty;
			expect(methods.GatewayDisplay).to.be.a('string').and.not.empty;
		});

		it('prompts bundle type for sensedia gateway and defaults to discovery for others', async () => {
			td.when(promptStubs.askList(td.matchers.anything())).thenResolve('All Agents');

			const sensediaBundle = await flowModule.askBundleType(flowModule.SensediaInstallMethods.GatewayDisplay);
			const otherBundle = await flowModule.askBundleType('Some Other Gateway');

			expect(sensediaBundle).to.equal('All Agents');
			expect(otherBundle).to.equal('Discovery');
		});
	});

	describe('AskGatewayQuestions', () => {
		it('collects OAuth auth details and environment loop entries', async () => {
			const askInputResponses = [
				'https://sensedia.example.com',
				'client-id',
				'client-secret',
				'dev@example.com',
				'prod',
				'stage',
				'',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const askListResponses = [ 'OAuth Client ID and Client Secret', 'Yes' ];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true, isTaEnabled: true }));

			expect(result.baseUrl).to.equal('https://sensedia.example.com');
			expect(result.authType).to.equal('OAuth Client ID and Client Secret');
			expect(result.clientId).to.equal('client-id');
			expect(result.clientSecret).to.equal('client-secret');
			expect(result.authToken).to.equal('');
			expect(result.environments).to.deep.equal([ 'prod', 'stage' ]);
		});

		it('collects static token auth when DA is enabled', async () => {
			const askInputResponses = [ 'https://sensedia.example.com', 'static-token', 'dev@example.com' ];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const askListResponses = [ 'Static Token', 'No' ];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const daResult = await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true, isTaEnabled: false }));
			expect(daResult.authType).to.equal('Static Token');
			expect(daResult.authToken).to.equal('static-token');
		});

		it('skips sensedia-specific prompts when DA is disabled', async () => {
			const taOnlyResult = await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: false, isTaEnabled: true }));
			expect(taOnlyResult.baseUrl).to.equal('');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(0);
		});

		it('wires Sensedia validators into base URL, email, and environment prompts', async () => {
			const validator = () => true;
			td.when(promptStubs.validateRegex(td.matchers.anything(), td.matchers.anything())).thenReturn(validator);

			const promptConfigs = [ ];
			const askInputResponses = [
				'https://sensedia.example.com',
				'client-id',
				'client-secret',
				'dev@example.com',
				'prod',
				'',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo((config) => {
				promptConfigs.push(config);
				return askInputResponses.shift();
			});

			const askListResponses = [ 'OAuth Client ID and Client Secret', 'Yes' ];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true, isTaEnabled: true }));

			expect(promptConfigs.find((config) => config.msg === 'Enter the Sensedia Base URL').validate).to.equal(validator);
			expect(promptConfigs.find((config) => config.msg === 'Enter the Developer Email').validate).to.equal(validator);
			expect(promptConfigs.find((config) => config.msg === 'Enter an environment name (or press Enter to finish)').validate).to.equal(validator);
			expect(td.explain(promptStubs.validateRegex).callCount).to.equal(4);
		});
	});

	describe('FinalizeGatewayInstall', () => {
		it('writes DA and TA templates when both enabled', async () => {
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

		it('stops finalize when Sensedia template generation fails', async () => {
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
