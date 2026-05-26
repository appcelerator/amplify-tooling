import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(__dirname, '../../../../../../dist');
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const AGENTS_INDEX = `${distRoot}/lib/engage/utils/agents/index.js`;
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/akamaiSaasAgents.js`;
const TYPES_MODULE = `${distRoot}/lib/engage/types.js`;

describe('Akamai SaaS agent flow', () => {
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
			name: 'dp-akamai',
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
			validateValueRange: td.func('validateValueRange'),
		};
		td.when(promptStubs.validateRegex(td.matchers.anything(), td.matchers.anything())).thenReturn(() => true);
		td.when(promptStubs.validateValueRange(td.matchers.anything())).thenReturn(() => true);
		await td.replaceEsm(BASIC_PROMPTS, promptStubs);

		helpersStubs = {
			...realHelpers,
			getCentralEnvironments: td.func('getCentralEnvironments'),
			createByResourceType: td.func('createByResourceType'),
			createNewDataPlaneResource: td.func('createNewDataPlaneResource'),
			createNewDataPlaneSecretResource: td.func('createNewDataPlaneSecretResource'),
			createNewAgentResource: td.func('createNewAgentResource'),
			deleteByResourceType: td.func('deleteByResourceType'),
		};
		await td.replaceEsm(AGENTS_INDEX, helpersStubs);

		td.when(helpersStubs.getCentralEnvironments(td.matchers.anything(), td.matchers.anything())).thenResolve([ { name: 'env-a' }, { name: 'env-b' } ]);
		td.when(helpersStubs.createByResourceType(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything())).thenResolve('new-env');
		td.when(helpersStubs.createNewDataPlaneResource(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(),
			td.matchers.anything(), td.matchers.anything(), td.matchers.anything())).thenResolve(dataplaneRes);
		td.when(helpersStubs.createNewDataPlaneSecretResource(td.matchers.anything(), td.matchers.anything(),
			td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything())).thenResolve();
		td.when(helpersStubs.createNewAgentResource(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything())).thenResolve('akamai-ca');
		td.when(helpersStubs.deleteByResourceType(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(),
			td.matchers.anything(), td.matchers.anything(), td.matchers.anything())).thenResolve();

		engageTypes = await import(TYPES_MODULE);
		flowModule = await import(FLOW_MODULE);
	});

	afterEach(() => td.reset());

	it('returns fixed bundle and hosted deployment type', async () => {
		const methods = flowModule.AkamaiSaaSInstallMethods;
		const bundleType = await methods.GetBundleType();
		const deploymentType = await methods.GetDeploymentType();
		expect(bundleType).to.equal(engageTypes.BundleType.TRACEABILITY);
		expect(deploymentType).to.equal(engageTypes.AgentConfigTypes.HOSTED);
	});

	it('collects Akamai connection and environment mappings', async () => {
		const askInputResponses = [
			'https://akamai.example.com',
			'client-id',
			'client-secret',
			1,
			'akamai-dev',
			'akamai-prod',
		];
		td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());
		const mappingResponses = [ 'env-b', 'env-a' ];
		const continueResponses = [ engageTypes.YesNo.Yes, engageTypes.YesNo.No ];
		td.when(promptStubs.askList(td.matchers.argThat((arg) => arg.msg?.includes('Select an Engage environment')))).thenDo(() => mappingResponses.shift());
		td.when(promptStubs.askList(td.matchers.argThat((arg) => arg.msg?.includes('enter another mapping')))).thenDo(() => continueResponses.shift());

		const result = await flowModule.AkamaiSaaSInstallMethods.AskGatewayQuestions(buildInstallConfig(engageTypes.GatewayTypes.AKAMAI));
		expect(result.baseUrl).to.equal('https://akamai.example.com');
		expect(result.environments).to.deep.equal([ 'akamai-dev', 'akamai-prod' ]);
		expect(result.centralEnvironments).to.deep.equal([ 'env-b', 'env-a' ]);
	});

	it('creates dataplane and CA resource on finalize', async () => {
		const config = buildInstallConfig(engageTypes.GatewayTypes.AKAMAI);
		config.gatewayConfig = {
			baseUrl: 'https://akamai.example.com',
			clientId: 'cid',
			clientSecret: 'csec',
			segmentLength: 2,
			environments: [ 'akamai-dev' ],
			centralEnvironments: [ 'env-b' ],
			getAccessData: () => JSON.stringify({ clientID: 'cid', clientSecret: 'csec' }),
		};

		await flowModule.AkamaiSaaSInstallMethods.FinalizeGatewayInstall(config, {}, {});
		expect(td.explain(helpersStubs.createNewDataPlaneResource).callCount).to.equal(1);
		expect(td.explain(helpersStubs.createNewAgentResource).callCount).to.equal(1);
	});

	it('rolls back by deleting environment when secret creation fails for new env', async () => {
		td.when(helpersStubs.createNewDataPlaneSecretResource(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything())).thenReject(new Error('secret failed'));

		const config = buildInstallConfig(engageTypes.GatewayTypes.AKAMAI);
		config.centralConfig.ampcEnvInfo.isNew = true;
		config.centralConfig.ampcEnvInfo.name = 'new-env';
		config.gatewayConfig = {
			baseUrl: 'https://akamai.example.com',
			clientId: 'cid',
			clientSecret: 'csec',
			segmentLength: 2,
			environments: [ 'akamai-dev' ],
			centralEnvironments: [ 'env-b' ],
			getAccessData: () => JSON.stringify({ clientID: 'cid', clientSecret: 'csec' }),
		};

		await flowModule.AkamaiSaaSInstallMethods.FinalizeGatewayInstall(config, {}, {});
		expect(td.explain(helpersStubs.createNewAgentResource).callCount).to.equal(0);
		const deleteCalls = td.explain(helpersStubs.deleteByResourceType).calls;
		expect(deleteCalls.length).to.equal(1);
		expect(deleteCalls[0].args[3]).to.equal('Environment');
	});

	it('rolls back by deleting dataplane when secret creation fails for existing env', async () => {
		td.when(helpersStubs.createNewDataPlaneSecretResource(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything())).thenReject(new Error('secret failed'));

		const config = buildInstallConfig(engageTypes.GatewayTypes.AKAMAI);
		config.centralConfig.ampcEnvInfo.isNew = false;
		config.gatewayConfig = {
			baseUrl: 'https://akamai.example.com',
			clientId: 'cid',
			clientSecret: 'csec',
			segmentLength: 2,
			environments: [ 'akamai-dev' ],
			centralEnvironments: [ 'env-b' ],
			getAccessData: () => JSON.stringify({ clientID: 'cid', clientSecret: 'csec' }),
		};

		await flowModule.AkamaiSaaSInstallMethods.FinalizeGatewayInstall(config, {}, {});
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
			isTaEnabled: true,
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
