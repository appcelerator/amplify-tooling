import { expect } from 'chai';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import crypto from 'crypto';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = pathToFileURL(path.resolve(__dirname, '../../../../../../dist')).href;
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const AGENTS_INDEX = `${distRoot}/lib/engage/utils/agents/index.js`;
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/swaggerHubSaasAgents.js`;
const TYPES_MODULE = `${distRoot}/lib/engage/types.js`;

describe('SwaggerHub SaaS agent flow', () => {
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
			name: 'dp-swaggerhub',
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
		td.when(helpersStubs.createNewAgentResource(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything())).thenResolve('swaggerhub-da');
		td.when(helpersStubs.deleteByResourceType(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(),
			td.matchers.anything())).thenResolve();

		engageTypes = await import(TYPES_MODULE);
		flowModule = await import(FLOW_MODULE);
	});

	afterEach(() => td.reset());

	it('returns fixed bundle and hosted deployment type', async () => {
		const methods = flowModule.SwaggerHubSaaSInstallMethods;
		const bundleType = await methods.GetBundleType();
		const deploymentType = await methods.GetDeploymentType();
		expect(bundleType).to.equal(engageTypes.BundleType.DISCOVERY);
		expect(deploymentType).to.equal(engageTypes.AgentConfigTypes.HOSTED);
	});

	it('collects API key, owner, visibility and publication filter', async () => {
		const askInputResponses = [
			'apiKeyapiKeyapiKeyapiKeyapiKeyapiKeyapiKeyapiKey',
			'30m',
			'axway-repo-owner',
		];
		td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

		const askListResponses = [
			engageTypes.YesNo.No,
			'Public',
			'Published',
		];
		td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

		const result = await flowModule.SwaggerHubSaaSInstallMethods.AskGatewayQuestions(buildInstallConfig(engageTypes.SaaSGatewayTypes.SWAGGERHUB));
		expect(result.owner).to.equal('axway-repo-owner');
		expect(result.visibility).to.equal('Public');
		expect(result.publication).to.equal('Published');
	});

	it('creates dataplane and DA resource on finalize', async () => {
		const config = buildInstallConfig(engageTypes.SaaSGatewayTypes.SWAGGERHUB);
		config.gatewayConfig = {
			owner: 'axway-repo-owner',
			visibility: 'Public',
			publication: 'Published',
			frequencyDA: '30m',
			queueDA: false,
			getAccessData: () => JSON.stringify({ apiKey: 'apiKeyapiKeyapiKeyapiKeyapiKeyapiKeyapiKeyapiKey' }),
		};

		await flowModule.SwaggerHubSaaSInstallMethods.FinalizeGatewayInstall(config, {}, {});
		expect(td.explain(helpersStubs.createNewDataPlaneResource).callCount).to.equal(1);
		expect(td.explain(helpersStubs.createNewAgentResource).callCount).to.equal(1);
	});

	it('rolls back by deleting environment when secret creation fails for new env', async () => {
		td.when(helpersStubs.createNewDataPlaneSecretResource(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything())).thenReject(new Error('secret failed'));

		const config = buildInstallConfig(engageTypes.SaaSGatewayTypes.SWAGGERHUB);
		config.centralConfig.ampcEnvInfo.isNew = true;
		config.centralConfig.ampcEnvInfo.name = 'new-env';
		config.gatewayConfig = {
			owner: 'axway-repo-owner',
			visibility: 'Public',
			publication: 'Published',
			frequencyDA: '30m',
			queueDA: false,
			getAccessData: () => JSON.stringify({ apiKey: 'apiKeyapiKeyapiKeyapiKeyapiKeyapiKeyapiKeyapiKey' }),
		};

		await flowModule.SwaggerHubSaaSInstallMethods.FinalizeGatewayInstall(config, {}, {});
		expect(td.explain(helpersStubs.createNewAgentResource).callCount).to.equal(0);
		const deleteCalls = td.explain(helpersStubs.deleteByResourceType).calls;
		expect(deleteCalls.length).to.equal(1);
		expect(deleteCalls[0].args[3]).to.equal('Environment');
	});

	it('rolls back by deleting dataplane when secret creation fails for existing env', async () => {
		td.when(helpersStubs.createNewDataPlaneSecretResource(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything())).thenReject(new Error('secret failed'));

		const config = buildInstallConfig(engageTypes.SaaSGatewayTypes.SWAGGERHUB);
		config.centralConfig.ampcEnvInfo.isNew = false;
		config.gatewayConfig = {
			owner: 'axway-repo-owner',
			visibility: 'Public',
			publication: 'Published',
			frequencyDA: '30m',
			queueDA: false,
			getAccessData: () => JSON.stringify({ apiKey: 'apiKeyapiKeyapiKeyapiKeyapiKeyapiKeyapiKeyapiKey' }),
		};

		await flowModule.SwaggerHubSaaSInstallMethods.FinalizeGatewayInstall(config, {}, {});
		expect(td.explain(helpersStubs.createNewAgentResource).callCount).to.equal(0);
		const deleteCalls = td.explain(helpersStubs.deleteByResourceType).calls;
		expect(deleteCalls.length).to.equal(1);
		expect(deleteCalls[0].args[3]).to.equal('Dataplane');
	});
});

function buildInstallConfig(gatewayType) {
	return {
		log: () => {},
		gatewayType,
		switches: {
			isDockerInstall: false,
			isHelmInstall: false,
			isHostedInstall: true,
			isDaEnabled: true,
			isTaEnabled: false,
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
