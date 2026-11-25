import { expect } from 'chai';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import crypto from 'crypto';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = pathToFileURL(path.resolve(__dirname, '../../../../../../dist')).href;
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const AGENTS_INDEX = `${distRoot}/lib/engage/utils/agents/index.js`;
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/apigeexSaasAgents.js`;
const TYPES_MODULE = `${distRoot}/lib/engage/types.js`;

describe('Apigee X SaaS agent flow', () => {
	let flowModule;
	let engageTypes;
	let promptStubs;
	let helpersStubs;
	let dataplaneRes;

	beforeEach(async () => {
		const realPrompts = await import(BASIC_PROMPTS);
		const realHelpers = await import(AGENTS_INDEX);
		const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
		dataplaneRes = {
			name: 'dp-apigeex',
			security: {
				encryptionKey: publicKey.export({ type: 'pkcs1', format: 'pem' }),
				encryptionHash: 'sha256',
			},
		};

		promptStubs = {
			...realPrompts,
			askInput: td.func('askInput'),
			askList: td.func('askList'),
			validateRegex: td.func('validateRegex'),
		};
		td.when(promptStubs.validateRegex(td.matchers.anything(), td.matchers.anything())).thenReturn(() => true);
		await td.replaceEsm(BASIC_PROMPTS, promptStubs);

		helpersStubs = {
			...realHelpers,
			askApigeeXMode: td.func('askApigeeXMode'),
			askGeminiAgentPlatformConfig: td.func('askGeminiAgentPlatformConfig'),
			createByResourceType: td.func('createByResourceType'),
			createNewDataPlaneResource: td.func('createNewDataPlaneResource'),
			createNewDataPlaneSecretResource: td.func('createNewDataPlaneSecretResource'),
			createNewAgentResource: td.func('createNewAgentResource'),
			deleteByResourceType: td.func('deleteByResourceType'),
		};
		await td.replaceEsm(AGENTS_INDEX, helpersStubs);

		td.when(helpersStubs.createByResourceType(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything())).thenResolve('new-env');
		td.when(helpersStubs.createNewDataPlaneResource(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(),
			td.matchers.anything(), td.matchers.anything())).thenResolve(dataplaneRes);
		td.when(helpersStubs.createNewDataPlaneSecretResource(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(),
			td.matchers.anything(), td.matchers.anything(), td.matchers.anything())).thenResolve();
		td.when(helpersStubs.createNewAgentResource(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything())).thenResolve('agent-name');
		td.when(helpersStubs.deleteByResourceType(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(),
			td.matchers.anything())).thenResolve();

		engageTypes = await import(TYPES_MODULE);
		flowModule = await import(FLOW_MODULE);
	});

	afterEach(() => td.reset());

	it('exports install methods with required hooks', () => {
		const methods = flowModule.APIGEEXSaaSInstallMethods;
		expect(methods).to.exist;
		expect(methods.GetBundleType).to.be.a('function');
		expect(methods.GetDeploymentType).to.be.a('function');
		expect(methods.AskGatewayQuestions).to.be.a('function');
		expect(methods.FinalizeGatewayInstall).to.be.a('function');
		expect(methods.ConfigFiles).to.be.an('array');
		expect(methods.GatewayDisplay).to.be.a('string').and.not.empty;
	});

	it('resolves deployment and bundle selections at runtime', async () => {
		const methods = flowModule.APIGEEXSaaSInstallMethods;
		td.when(promptStubs.askList(td.matchers.anything())).thenResolve(engageTypes.BundleType.ALL_AGENTS);
		const deploymentType = await methods.GetDeploymentType(methods.GatewayDisplay);
		const bundleType = await methods.GetBundleType(methods.GatewayDisplay);
		expect(deploymentType).to.equal(engageTypes.AgentConfigTypes.HOSTED);
		expect(bundleType).to.equal(engageTypes.BundleType.ALL_AGENTS);
	});

	it('collects the Gemini Enterprise Agent Platform settings in place of the metrics filter and environment', async () => {
		const geminiAgentPlatform = { locations: [ 'us-central1' ], runtimes: [ ], gateways: [ ], mcpDiscoveryEnabled: true };
		td.when(helpersStubs.askApigeeXMode()).thenResolve(engageTypes.APIGEEXDISCOVERYMODES.GEMINI_AGENT_PLATFORM);
		td.when(helpersStubs.askGeminiAgentPlatformConfig()).thenResolve(geminiAgentPlatform);

		const askInputResponses = [
			'rd-amplify-apigee-x',
			'dev@example.com',
			'client@example.com',
			'30m',
			'1h',
		];
		td.when(promptStubs.askInput(td.matchers.anything()))
			.thenDo(() => askInputResponses.shift());
		td.when(promptStubs.askList(td.matchers.anything())).thenResolve('No');

		const result = await flowModule.APIGEEXSaaSInstallMethods.AskGatewayQuestions(
			buildInstallConfig(engageTypes.SaaSGatewayTypes.APIGEEX_GATEWAY, true)
		);

		expect(result.mode).to.equal(engageTypes.APIGEEXDISCOVERYMODES.GEMINI_AGENT_PLATFORM);
		expect(result.projectId).to.equal('rd-amplify-apigee-x');
		expect(result.developerEmailAddress).to.equal('dev@example.com');
		expect(result.clientEmailAddress).to.equal('client@example.com');
		expect(result.geminiAgentPlatform).to.deep.equal(geminiAgentPlatform);
		expect(result.frequencyDA).to.equal('30m');
		expect(result.frequencyTA).to.equal('1h');
		// no metrics filter or environment prompts: the only list left is queueing the discovery
		expect(td.explain(promptStubs.askInput).callCount).to.equal(5);
		expect(td.explain(promptStubs.askList).callCount).to.equal(1);
	});

	it('creates DA and TA resources when TA is enabled', async () => {
		const config = buildInstallConfig(engageTypes.SaaSGatewayTypes.APIGEEX_GATEWAY, true);
		config.gatewayConfig = {
			projectId: 'rd-amplify-apigee-x',
			developerEmailAddress: 'dev@example.com',
			mode: engageTypes.APIGEEXDISCOVERYMODES.PROXY,
			metricsFilter: new engageTypes.ApigeeMetricsFilterConfig(true, [ 'payments-api' ]),
			environment: 'prod',
			frequencyDA: '30m',
			queueDA: false,
			frequencyTA: '1h',
			getAccessData: () => JSON.stringify({ client_email: 'client@example.com' }),
		};

		await flowModule.APIGEEXSaaSInstallMethods.FinalizeGatewayInstall(config, {}, {});
		expect(td.explain(helpersStubs.createNewAgentResource).callCount).to.equal(2);
	});

	it('sends the Gemini Enterprise Agent Platform settings on the dataplane in place of the metrics filter and environment', async () => {
		const geminiAgentPlatform = { locations: [ 'us-central1' ], runtimes: [ ], gateways: [ ], mcpDiscoveryEnabled: true };
		const config = buildInstallConfig(engageTypes.SaaSGatewayTypes.APIGEEX_GATEWAY, true);
		config.gatewayConfig = {
			projectId: 'rd-amplify-apigee-x',
			developerEmailAddress: 'dev@example.com',
			mode: engageTypes.APIGEEXDISCOVERYMODES.GEMINI_AGENT_PLATFORM,
			geminiAgentPlatform,
			metricsFilter: new engageTypes.ApigeeMetricsFilterConfig(true, [ ]),
			environment: '',
			frequencyDA: '30m',
			queueDA: false,
			frequencyTA: '1h',
			getAccessData: () => JSON.stringify({ client_email: 'client@example.com' }),
		};

		await flowModule.APIGEEXSaaSInstallMethods.FinalizeGatewayInstall(config, {}, {});

		// the dataplane config is sent as JSON, which leaves out the fields a mode does not set
		const sent = JSON.parse(JSON.stringify(td.explain(helpersStubs.createNewDataPlaneResource).calls[0].args[4]));
		expect(sent.mode).to.equal(engageTypes.APIGEEXDISCOVERYMODES.GEMINI_AGENT_PLATFORM);
		expect(sent.projectId).to.equal('rd-amplify-apigee-x');
		expect(sent.developerEmail).to.equal('dev@example.com');
		expect(sent.geminiAgentPlatform).to.deep.equal(geminiAgentPlatform);
		expect(sent).to.not.have.any.keys('metricsFilter', 'environment');
	});

	it('sends the metrics filter and environment on the dataplane in proxy mode', async () => {
		const config = buildInstallConfig(engageTypes.SaaSGatewayTypes.APIGEEX_GATEWAY, true);
		config.gatewayConfig = {
			projectId: 'rd-amplify-apigee-x',
			developerEmailAddress: 'dev@example.com',
			mode: engageTypes.APIGEEXDISCOVERYMODES.PROXY,
			geminiAgentPlatform: { locations: [ ], runtimes: [ ], gateways: [ ], mcpDiscoveryEnabled: true },
			metricsFilter: new engageTypes.ApigeeMetricsFilterConfig(true, [ 'payments-api' ]),
			environment: 'prod',
			frequencyDA: '30m',
			queueDA: false,
			frequencyTA: '1h',
			getAccessData: () => JSON.stringify({ client_email: 'client@example.com' }),
		};

		await flowModule.APIGEEXSaaSInstallMethods.FinalizeGatewayInstall(config, {}, {});

		const sent = JSON.parse(JSON.stringify(td.explain(helpersStubs.createNewDataPlaneResource).calls[0].args[4]));
		expect(sent.mode).to.equal(engageTypes.APIGEEXDISCOVERYMODES.PROXY);
		expect(sent.metricsFilter).to.deep.equal({ filterMetrics: true, filteredAPIs: [ 'payments-api' ] });
		expect(sent.environment).to.equal('prod');
		expect(sent).to.not.have.property('geminiAgentPlatform');
	});

	it('rolls back by deleting environment when secret creation fails for new env', async () => {
		td.when(helpersStubs.createNewDataPlaneSecretResource(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything())).thenReject(new Error('secret failed'));

		const config = buildInstallConfig(engageTypes.SaaSGatewayTypes.APIGEEX_GATEWAY, true);
		config.centralConfig.ampcEnvInfo.isNew = true;
		config.centralConfig.ampcEnvInfo.name = 'new-env';
		config.gatewayConfig = {
			projectId: 'rd-amplify-apigee-x',
			developerEmailAddress: 'dev@example.com',
			mode: engageTypes.APIGEEXDISCOVERYMODES.PROXY,
			metricsFilter: new engageTypes.ApigeeMetricsFilterConfig(true, [ 'payments-api' ]),
			environment: 'prod',
			frequencyDA: '30m',
			queueDA: false,
			frequencyTA: '1h',
			getAccessData: () => JSON.stringify({ client_email: 'client@example.com' }),
		};

		await flowModule.APIGEEXSaaSInstallMethods.FinalizeGatewayInstall(config, {}, {});
		expect(td.explain(helpersStubs.createNewAgentResource).callCount).to.equal(0);
		const deleteCalls = td.explain(helpersStubs.deleteByResourceType).calls;
		expect(deleteCalls.length).to.equal(1);
		expect(deleteCalls[0].args[3]).to.equal('Environment');
	});

	it('rolls back by deleting dataplane when secret creation fails for existing env', async () => {
		td.when(helpersStubs.createNewDataPlaneSecretResource(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything())).thenReject(new Error('secret failed'));

		const config = buildInstallConfig(engageTypes.SaaSGatewayTypes.APIGEEX_GATEWAY, true);
		config.centralConfig.ampcEnvInfo.isNew = false;
		config.gatewayConfig = {
			projectId: 'rd-amplify-apigee-x',
			developerEmailAddress: 'dev@example.com',
			mode: engageTypes.APIGEEXDISCOVERYMODES.PROXY,
			metricsFilter: new engageTypes.ApigeeMetricsFilterConfig(true, [ 'payments-api' ]),
			environment: 'prod',
			frequencyDA: '30m',
			queueDA: false,
			frequencyTA: '1h',
			getAccessData: () => JSON.stringify({ client_email: 'client@example.com' }),
		};

		await flowModule.APIGEEXSaaSInstallMethods.FinalizeGatewayInstall(config, {}, {});
		expect(td.explain(helpersStubs.createNewAgentResource).callCount).to.equal(0);
		const deleteCalls = td.explain(helpersStubs.deleteByResourceType).calls;
		expect(deleteCalls.length).to.equal(1);
		expect(deleteCalls[0].args[3]).to.equal('Dataplane');
	});
});

function buildInstallConfig(gatewayType, isTaEnabled) {
	return {
		log: () => {},
		gatewayType,
		switches: {
			isDockerInstall: false,
			isHelmInstall: false,
			isHostedInstall: true,
			isDaEnabled: true,
			isTaEnabled,
		},
		centralConfig: {
			apiServerClient: {},
			definitionManager: {},
			ampcEnvInfo: { name: 'installed-env', isNew: false },
			ampcDosaInfo: { isNew: false },
			ampcTeamName: 'team-a',
			dosaAccount: { publicKey: 'pub.pem', privateKey: 'priv.pem' },
		},
		deploymentType: 'Hosted',
		traceabilityConfig: {},
		gatewayConfig: {},
	};
}
