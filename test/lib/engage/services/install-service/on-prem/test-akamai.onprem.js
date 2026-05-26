import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(__dirname, '../../../../../../dist');
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const AGENTS_INDEX  = `${distRoot}/lib/engage/utils/agents/index.js`;
const KUBECTL_MODULE = `${distRoot}/lib/engage/utils/agents/kubectl.js`;
const UTILS_MODULE = `${distRoot}/lib/engage/utils/utils.js`;

describe('Akamai on-prem agent flow', () => {
	let akamaiAgent;
	let promptStubs;
	let helpersStubs;
	let kubectlStubs;
	let utilsStubs;

	beforeEach(async function () {
		this.timeout(10000);
		// Auto-stub all exports: functions become td.func(), non-functions keep real values.
		promptStubs  = await td.replaceEsm(BASIC_PROMPTS);
		helpersStubs = await td.replaceEsm(AGENTS_INDEX);
		kubectlStubs = {
			isInstalled: td.func('kubectl.isInstalled'),
			create: td.func('kubectl.create'),
		};
		await td.replaceEsm(KUBECTL_MODULE, {
			kubectl: kubectlStubs,
		});
		utilsStubs = await td.replaceEsm(UTILS_MODULE);

		// Configure getCentralEnvironments to return one fake environment.
		td.when(helpersStubs.getCentralEnvironments(td.matchers.anything(), td.matchers.anything()))
			.thenResolve([ { name: 'env-test' } ]);
		td.when(kubectlStubs.isInstalled())
			.thenResolve({ error: null });
		td.when(kubectlStubs.create(td.matchers.anything(), td.matchers.anything()))
			.thenResolve({ data: [ 'created' ], error: null });
		td.when(helpersStubs.askNamespace(td.matchers.anything(), td.matchers.anything()))
			.thenResolve({ name: 'amplify-agents', isNew: false });
		td.when(helpersStubs.createSecret(td.matchers.anything(), td.matchers.anything(), td.matchers.isA(Function)))
			.thenDo((_namespace, _secret, callback) => callback());

		// Import the subject only AFTER all replaceEsm calls.
		akamaiAgent = await import(`${distRoot}/lib/engage/utils/agents/flows/akamaiAgent.js`);
	});

	afterEach(() => td.reset());

	describe('AskGatewayQuestions (docker mode)', () => {
		it('collects baseUrl, clientId, clientSecret, segmentLength, and one environment mapping', async () => {
			const askInputResponses = [
				'https://akamai.example.com',
				'my-client-id',
				'my-client-secret',
				5,
				'my-akamai-env',
			];
			td.when(promptStubs.askInput(td.matchers.anything()))
				.thenDo(() => askInputResponses.shift());

			const askListResponses = [ 'env-test', 'No' ];
			td.when(promptStubs.askList(td.matchers.anything()))
				.thenDo(() => askListResponses.shift());

			const result = await akamaiAgent.gatewayConnectivity(buildInstallConfig({ isDockerInstall: true }));

			expect(result.baseUrl).to.equal('https://akamai.example.com');
			expect(result.clientId).to.equal('my-client-id');
			expect(result.clientSecret).to.equal('my-client-secret');
			expect(result.segmentLength).to.equal(5);
			expect(result.environments).to.deep.equal([ 'my-akamai-env' ]);
			expect(result.centralEnvironments).to.deep.equal([ 'env-test' ]);

			expect(td.explain(promptStubs.askInput).callCount).to.equal(5);
			expect(td.explain(promptStubs.askList).callCount).to.equal(1);
		});

		it('supports adding multiple environment mappings', async () => {
			td.when(helpersStubs.getCentralEnvironments(td.matchers.anything(), td.matchers.anything()))
				.thenResolve([ { name: 'central-A' }, { name: 'central-B' } ]);

			const askInputResponses = [
				'https://akamai.example.com',
				'client-id',
				'client-secret',
				3,
				'env-A',
				'env-B',
			];
			td.when(promptStubs.askInput(td.matchers.anything()))
				.thenDo(() => askInputResponses.shift());

			// First pair: env-A -> central-A, then 'Yes' to add another
			// Second pair: env-B -> central-B, then 'No' to stop
			const askListResponses = [ 'central-A', 'Yes', 'central-B', 'No' ];
			td.when(promptStubs.askList(td.matchers.anything()))
				.thenDo(() => askListResponses.shift());

			const result = await akamaiAgent.gatewayConnectivity(buildInstallConfig({ isDockerInstall: true }));

			expect(result.environments).to.deep.equal([ 'env-A', 'env-B' ]);
			expect(result.centralEnvironments).to.deep.equal([ 'central-A', 'central-B' ]);
		});

		it('exits when no mappable central environments are available', async () => {
			td.when(helpersStubs.getCentralEnvironments(td.matchers.anything(), td.matchers.anything()))
				.thenResolve([ { name: 'installed-env' } ]);

			const askInputResponses = [
				'https://akamai.example.com',
				'client-id',
				'client-secret',
				3,
			];
			td.when(promptStubs.askInput(td.matchers.anything()))
				.thenDo(() => askInputResponses.shift());

			const originalExit = process.exit;
			process.exit = ((code) => {
				throw new Error(`process.exit(${code})`);
			});

			try {
				await akamaiAgent.gatewayConnectivity(buildInstallConfig({ isDockerInstall: true }));
				throw new Error('Expected gatewayConnectivity to exit');
			} catch (err) {
				expect(err.message).to.equal('process.exit(1)');
			} finally {
				process.exit = originalExit;
			}
		});
	});

	describe('AskGatewayQuestions (helm mode)', () => {
		it('checks kubectl and asks for namespace before collecting Akamai inputs', async () => {
			const askInputResponses = [
				'https://akamai.example.com',
				'my-client-id',
				'my-client-secret',
				5,
				'my-akamai-env',
			];
			td.when(promptStubs.askInput(td.matchers.anything()))
				.thenDo(() => askInputResponses.shift());

			const askListResponses = [ 'env-test', 'No' ];
			td.when(promptStubs.askList(td.matchers.anything()))
				.thenDo(() => askListResponses.shift());

			const result = await akamaiAgent.gatewayConnectivity(buildInstallConfig({ isHelmInstall: true }));

			expect(result.namespace.name).to.equal('amplify-agents');
			expect(td.explain(kubectlStubs.isInstalled).callCount).to.equal(1);
			expect(td.explain(helpersStubs.askNamespace).callCount).to.equal(1);
		});

		it('throws a helpful error when kubectl is unavailable', async () => {
			td.when(kubectlStubs.isInstalled())
				.thenResolve({ error: 'kubectl not found' });

			try {
				await akamaiAgent.gatewayConnectivity(buildInstallConfig({ isHelmInstall: true }));
				throw new Error('Expected kubectl error');
			} catch (err) {
				expect(err.message).to.contain('Kubectl is required');
				expect(err.message).to.contain('kubectl not found');
			}
		});
	});

	describe('FinalizeGatewayInstall', () => {
		it('writes docker env file on docker install', async () => {
			const installConfig = buildInstallConfig({ isDockerInstall: true });
			installConfig.gatewayConfig = {
				baseUrl: 'https://akamai.example.com',
				clientId: 'client-id',
				clientSecret: 'client-secret',
				segmentLength: 2,
				environments: [ 'env-A' ],
				centralEnvironments: [ 'central-A' ],
				namespace: { name: 'amplify-agents', isNew: false },
			};

			await akamaiAgent.completeInstall(installConfig);

			td.verify(utilsStubs.writeTemplates('agent_env_vars.env', td.matchers.anything(), td.matchers.anything()), { times: 1 });
		});

		it('creates helm secrets and writes helm override on helm install', async () => {
			const installConfig = buildInstallConfig({ isHelmInstall: true });
			installConfig.deploymentType = 'HELM';
			installConfig.centralConfig.ampcDosaInfo.isNew = true;
			installConfig.gatewayConfig = {
				baseUrl: 'https://akamai.example.com',
				clientId: 'client-id',
				clientSecret: 'client-secret',
				segmentLength: 2,
				environments: [ 'env-A' ],
				centralEnvironments: [ 'central-A' ],
				namespace: { name: 'amplify-agents', isNew: true },
			};

			await akamaiAgent.completeInstall(installConfig);

			expect(td.explain(helpersStubs.createNamespace).callCount).to.equal(1);
			expect(td.explain(helpersStubs.createSecret).callCount).to.equal(2);
			expect(td.explain(helpersStubs.createAmplifyAgentKeysSecret).callCount).to.equal(1);
			expect(td.explain(kubectlStubs.create).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeTemplates).calls[0].args[0]).to.equal('agent-overrides.yaml');
		});

		it('stops helm install when namespace creation fails', async () => {
			td.when(helpersStubs.createNamespace(td.matchers.anything(), td.matchers.anything()))
				.thenReject(new Error('namespace failed'));

			const installConfig = buildInstallConfig({ isHelmInstall: true });
			installConfig.gatewayConfig = {
				baseUrl: 'https://akamai.example.com',
				clientId: 'client-id',
				clientSecret: 'client-secret',
				segmentLength: 2,
				environments: [ 'env-A' ],
				centralEnvironments: [ 'central-A' ],
				namespace: { name: 'amplify-agents', isNew: true },
			};

			let error;
			try {
				await akamaiAgent.completeInstall(installConfig);
			} catch (err) {
				error = err;
			}

			expect(error).to.be.instanceOf(Error);
			expect(error.message).to.equal('namespace failed');
			expect(td.explain(helpersStubs.createSecret).callCount).to.equal(0);
			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(0);
		});

		it('stops helm install when Akamai credentials secret creation fails', async () => {
			td.when(kubectlStubs.create(td.matchers.anything(), td.matchers.anything()))
				.thenResolve({ data: [ ], error: 'secret failed' });

			const installConfig = buildInstallConfig({ isHelmInstall: true });
			installConfig.gatewayConfig = {
				baseUrl: 'https://akamai.example.com',
				clientId: 'client-id',
				clientSecret: 'client-secret',
				segmentLength: 2,
				environments: [ 'env-A' ],
				centralEnvironments: [ 'central-A' ],
				namespace: { name: 'amplify-agents', isNew: false },
			};

			let error;
			try {
				await akamaiAgent.completeInstall(installConfig);
			} catch (err) {
				error = err;
			}

			expect(error).to.be.instanceOf(Error);
			expect(error.message).to.equal('secret failed');
			expect(td.explain(helpersStubs.createSecret).callCount).to.equal(2);
			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(0);
		});
	});
});

function buildInstallConfig({ isDockerInstall = false, isHelmInstall = false } = {}) {
	return {
		log: () => {},
		switches: {
			isDockerInstall,
			isHelmInstall,
			isHostedInstall: false,
		},
		centralConfig: {
			apiServerClient:   {},
			definitionManager: {},
			ampcEnvInfo:       { name: 'installed-env' },
			ampcDosaInfo:      { isNew: false },
			dosaAccount:       { publicKey: 'pub.pem', privateKey: 'priv.pem' },
		},
		deploymentType:    'DOCKERIZED',
		caVersion:         '1.2.3',
		traceabilityConfig: {},
		gatewayConfig:     {},
	};
}

