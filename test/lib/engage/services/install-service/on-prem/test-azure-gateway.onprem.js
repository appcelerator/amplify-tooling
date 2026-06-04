import { expect } from 'chai';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = pathToFileURL(path.resolve(__dirname, '../../../../../../dist')).href;
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const UTILS_MODULE = `${distRoot}/lib/engage/utils/utils.js`;
const TYPES_MODULE = `${distRoot}/lib/engage/types.js`;
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/azureAgents.js`;

describe('Azure on-prem agent flow', () => {
	let flowModule;
	let engageTypes;
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

		engageTypes = await import(TYPES_MODULE);
		flowModule = await import(FLOW_MODULE);
	});

	afterEach(() => td.reset());

	describe('AzureInstallMethods metadata', () => {
		it('exports install methods with required hooks', () => {
			const methods = flowModule.AzureInstallMethods;
			expect(methods).to.exist;
			expect(methods.GetBundleType).to.be.a('function');
			expect(methods.GetDeploymentType).to.be.a('function');
			expect(methods.AskGatewayQuestions).to.be.a('function');
			expect(methods.FinalizeGatewayInstall).to.be.a('function');
			expect(methods.ConfigFiles).to.be.an('array').that.is.not.empty;
			expect(methods.GatewayDisplay).to.be.a('string').and.not.empty;
		});

		it('returns dockerized deployment type without prompting', async () => {
			const deploymentType = await flowModule.askConfigType();
			expect(deploymentType).to.exist;
			expect(td.explain(promptStubs.askList).callCount).to.equal(0);
		});

		it('prompts for bundle choice for AZURE_GATEWAY', async () => {
			td.when(promptStubs.askList(td.matchers.anything())).thenResolve('ALL_AGENTS');

			const bundleType = await flowModule.askBundleType(flowModule.AzureInstallMethods.GatewayDisplay);

			expect(bundleType).to.equal('ALL_AGENTS');
			expect(td.explain(promptStubs.askList).callCount).to.equal(1);
		});

		it('defaults to discovery bundle for AZURE_EVENTHUB without prompting', async () => {
			const bundleType = await flowModule.askBundleType(engageTypes.GatewayTypes.AZURE_EVENTHUB);

			expect(bundleType).to.equal(engageTypes.BundleType.DISCOVERY);
			expect(td.explain(promptStubs.askList).callCount).to.equal(0);
		});
	});

	describe('AskGatewayQuestions', () => {
		it('collects DA+TA prompts for AZURE_GATEWAY', async () => {
			const askInputResponses = [
				'tenant-id',
				'subscription-id',
				'sp-client-id',
				'sp-client-secret',
				'rg-name',
				'apim-name',
				'eventhub-namespace',
				'eventhub-name',
				'RootManageSharedAccessKey',
				'policy-key',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const result = await flowModule.gatewayConnectivity(
				buildInstallConfig({ gatewayType: flowModule.AzureInstallMethods.GatewayDisplay, isDaEnabled: true, isTaEnabled: true })
			);

			expect(result.isAzureEventHub).to.equal(false);
			expect(result.apiManagementServiceName).to.equal('apim-name');
			expect(result.eventHubNamespace).to.equal('eventhub-namespace');
			expect(result.eventHubName).to.equal('eventhub-name');
			expect(result.policyKey).to.equal('policy-key');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(10);
		});

		it('collects DA-only prompts for AZURE_EVENTHUB and uses eventhub namespace prompt', async () => {
			const askInputResponses = [
				'tenant-id',
				'subscription-id',
				'sp-client-id',
				'sp-client-secret',
				'rg-name',
				'eventhub-namespace',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const result = await flowModule.gatewayConnectivity(
				buildInstallConfig({ gatewayType: engageTypes.GatewayTypes.AZURE_EVENTHUB, isDaEnabled: true, isTaEnabled: false })
			);

			expect(result.isAzureEventHub).to.equal(true);
			expect(result.apiManagementServiceName).to.equal('');
			expect(result.eventHubNamespace).to.equal('eventhub-namespace');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(6);
		});

		it('collects TA-only prompts and still asks discovery prompts needed for TA auth', async () => {
			const askInputResponses = [
				'eventhub-namespace',
				'eventhub-name',
				'RootManageSharedAccessKey',
				'policy-key',
				'tenant-id',
				'subscription-id',
				'sp-client-id',
				'sp-client-secret',
				'rg-name',
				'apim-name',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const result = await flowModule.gatewayConnectivity(
				buildInstallConfig({ gatewayType: flowModule.AzureInstallMethods.GatewayDisplay, isDaEnabled: false, isTaEnabled: true })
			);

			expect(result.eventHubName).to.equal('eventhub-name');
			expect(result.policyName).to.equal('RootManageSharedAccessKey');
			expect(result.apiManagementServiceName).to.equal('apim-name');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(10);
		});

		it('wires API management service name validation into the discovery prompt', async () => {
			const validator = () => true;
			td.when(promptStubs.validateRegex(td.matchers.anything(), td.matchers.anything())).thenReturn(validator);

			const promptConfigs = [ ];
			const askInputResponses = [
				'tenant-id',
				'subscription-id',
				'sp-client-id',
				'sp-client-secret',
				'rg-name',
				'apim-name',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo((config) => {
				promptConfigs.push(config);
				return askInputResponses.shift();
			});

			await flowModule.gatewayConnectivity(
				buildInstallConfig({ gatewayType: flowModule.AzureInstallMethods.GatewayDisplay, isDaEnabled: true, isTaEnabled: false })
			);

			const apimPrompt = promptConfigs.find((config) => config.msg === 'Enter the Azure API Management Service Name');
			expect(apimPrompt).to.exist;
			expect(apimPrompt.validate).to.equal(validator);
			expect(td.explain(promptStubs.validateRegex).callCount).to.equal(1);
		});
	});

	describe('FinalizeGatewayInstall', () => {
		it('writes DA and TA templates when both bundles are enabled', async () => {
			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: true });
			installConfig.gatewayConfig = {
				tenantId: 'tenant-id',
				subscriptionId: 'subscription-id',
				servicePrincipalClientId: 'sp-client-id',
				servicePrincipalClientSecret: 'sp-client-secret',
				resourceGroupName: 'rg-name',
				apiManagementServiceName: 'apim-name',
				eventHubNamespace: 'eventhub-namespace',
				eventHubName: 'eventhub-name',
				policyName: 'RootManageSharedAccessKey',
				policyKey: 'policy-key',
			};

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(2);
			const files = td.explain(utilsStubs.writeTemplates).calls.map((call) => call.args[0]);
			expect(files).to.include(flowModule.ConfigFiles.DAEnvVars);
			expect(files).to.include(flowModule.ConfigFiles.TAEnvVars);
		});

		it('writes only DA template when traceability is disabled', async () => {
			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: false });
			installConfig.gatewayConfig = {};

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeTemplates).calls[0].args[0]).to.equal(flowModule.ConfigFiles.DAEnvVars);
		});

		it('writes only TA template when discovery is disabled', async () => {
			const installConfig = buildInstallConfig({ isDaEnabled: false, isTaEnabled: true });
			installConfig.gatewayConfig = {};

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeTemplates).calls[0].args[0]).to.equal(flowModule.ConfigFiles.TAEnvVars);
		});

		it('logs service-account warning when dosa is new and install is not helm', async () => {
			const logs = [ ];
			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: false, logSink: logs });
			installConfig.centralConfig.ampcDosaInfo.isNew = true;
			installConfig.gatewayConfig = {};

			await flowModule.completeInstall(installConfig);

			expect(logs.some((line) => line.includes('private_key.pem'))).to.equal(true);
		});

		it('stops writing templates when the first Azure template generation fails', async () => {
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
	gatewayType = 'Azure API Gateway',
	isDaEnabled = true,
	isTaEnabled = true,
	logSink = null,
} = {}) {
	const logs = logSink || [ ];
	return {
		log: (msg) => logs.push(String(msg)),
		gatewayType,
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
