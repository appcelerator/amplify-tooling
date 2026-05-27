import { expect } from 'chai';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = pathToFileURL(path.resolve(__dirname, '../../../../../../dist')).href;
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const AGENTS_INDEX = `${distRoot}/lib/engage/utils/agents/index.js`;
const KUBECTL_MODULE = `${distRoot}/lib/engage/utils/agents/kubectl.js`;
const UTILS_MODULE = `${distRoot}/lib/engage/utils/utils.js`;
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/traceableAgents.js`;

describe('Traceable on-prem agent flow', () => {
	let flowModule;
	let promptStubs;
	let helpersStubs;
	let kubectlStubs;
	let utilsStubs;

	beforeEach(async () => {
		const realPrompts = await import(BASIC_PROMPTS);
		promptStubs = {
			...realPrompts,
			askInput: td.func('askInput'),
			askList: td.func('askList'),
		};
		await td.replaceEsm(BASIC_PROMPTS, promptStubs);

		const realHelpers = await import(AGENTS_INDEX);
		helpersStubs = {
			...realHelpers,
			askNamespace: td.func('askNamespace'),
			getCentralEnvironments: td.func('getCentralEnvironments'),
			createNamespace: td.func('createNamespace'),
			createSecret: td.func('createSecret'),
			createAmplifyAgentKeysSecret: td.func('createAmplifyAgentKeysSecret'),
		};
		await td.replaceEsm(AGENTS_INDEX, helpersStubs);

		kubectlStubs = {
			isInstalled: td.func('kubectl.isInstalled'),
			create: td.func('kubectl.create'),
		};
		await td.replaceEsm(KUBECTL_MODULE, { kubectl: kubectlStubs });

		const realUtils = await import(UTILS_MODULE);
		utilsStubs = {
			...realUtils,
			writeTemplates: td.func('writeTemplates'),
		};
		await td.replaceEsm(UTILS_MODULE, utilsStubs);

		td.when(kubectlStubs.isInstalled()).thenResolve({ error: null });
		td.when(kubectlStubs.create(td.matchers.anything(), td.matchers.anything())).thenResolve({ error: null });
		td.when(helpersStubs.askNamespace(td.matchers.anything(), td.matchers.anything())).thenResolve({ name: 'amplify-agents', isNew: false });
		td.when(helpersStubs.getCentralEnvironments(td.matchers.anything(), td.matchers.anything())).thenResolve([
			{ name: 'dev' },
			{ name: 'qa' },
			{ name: 'prod' },
		]);
		td.when(helpersStubs.createSecret(td.matchers.anything(), td.matchers.anything(), td.matchers.isA(Function))).thenDo((_ns, _secret, cb) => cb());
		td.when(helpersStubs.createAmplifyAgentKeysSecret(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(),
			td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything())).thenResolve();

		flowModule = await import(FLOW_MODULE);
	});

	afterEach(() => td.reset());

	describe('TraceableInstallMethods metadata', () => {
		it('exports install methods with required hooks', () => {
			const methods = flowModule.TraceableInstallMethods;
			expect(methods).to.exist;
			expect(methods.GetBundleType).to.be.a('function');
			expect(methods.GetDeploymentType).to.be.a('function');
			expect(methods.AskGatewayQuestions).to.be.a('function');
			expect(methods.FinalizeGatewayInstall).to.be.a('function');
			expect(methods.ConfigFiles).to.be.an('array').that.is.not.empty;
			expect(methods.GatewayDisplay).to.be.a('string').and.not.empty;
		});

		it('returns static traceability bundle and prompts deployment type', async () => {
			td.when(promptStubs.askList(td.matchers.anything())).thenResolve('Dockerized');
			const bundleType = await flowModule.askBundleType();
			const configType = await flowModule.askConfigType();
			expect(bundleType).to.equal('Traceability');
			expect(configType).to.equal('Dockerized');
		});
	});

	describe('AskGatewayQuestions', () => {
		it('collects docker-mode prompts and environment mappings', async () => {
			const askInputResponses = [ 'traceable-token', 'traceable-dev', 'traceable-qa' ];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const askListResponses = [ 'us', 'dev', 'Yes', 'qa', 'No' ];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDockerInstall: true, isHelmInstall: false }));
			expect(result.traceableToken).to.equal('traceable-token');
			expect(result.traceableRegion).to.equal('us');
			expect(result.environments).to.deep.equal([ 'traceable-dev', 'traceable-qa' ]);
			expect(result.centralEnvironments).to.deep.equal([ 'dev', 'qa' ]);
		});

		it('collects helm namespace and checks kubectl', async () => {
			const askInputResponses = [ 'traceable-token', '' ];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());
			const askListResponses = [ 'us', 'dev', 'No' ];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDockerInstall: false, isHelmInstall: true }));
			expect(result.namespace.name).to.equal('amplify-agents');
			expect(td.explain(kubectlStubs.isInstalled).callCount).to.equal(1);
		});

		it('exits when no central environments are available for mapping', async () => {
			td.when(helpersStubs.getCentralEnvironments(td.matchers.anything(), td.matchers.anything())).thenResolve([
				{ name: 'installed-env' },
			]);
			const askInputResponses = [ 'traceable-token' ];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());
			td.when(promptStubs.askList(td.matchers.anything())).thenResolve('us');

			const originalExit = process.exit;
			process.exit = ((code) => {
				throw new Error(`process.exit(${code})`);
			});

			try {
				await flowModule.gatewayConnectivity(buildInstallConfig({ isDockerInstall: true, isHelmInstall: false }));
				throw new Error('Expected gatewayConnectivity to exit');
			} catch (err) {
				expect(err.message).to.equal('process.exit(1)');
			} finally {
				process.exit = originalExit;
			}
		});
	});

	describe('FinalizeGatewayInstall', () => {
		it('writes docker env vars in docker mode', async () => {
			const installConfig = buildInstallConfig({ isDockerInstall: true, isHelmInstall: false });
			installConfig.gatewayConfig = {
				traceableToken: 'traceable-token',
				environments: [ 'traceable-dev' ],
				centralEnvironments: [ 'dev' ],
			};

			await flowModule.completeInstall(installConfig);
			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeTemplates).calls[0].args[0]).to.equal(flowModule.ConfigFiles.agentEnvVars);
		});

		it('writes helm override and creates secrets in helm mode', async () => {
			const installConfig = buildInstallConfig({ isDockerInstall: false, isHelmInstall: true });
			installConfig.gatewayConfig = {
				namespace: { name: 'amplify-agents', isNew: true },
				traceableToken: 'traceable-token',
				environments: [ 'traceable-dev' ],
				centralEnvironments: [ 'dev' ],
			};

			await flowModule.completeInstall(installConfig);
			expect(td.explain(helpersStubs.createNamespace).callCount).to.equal(1);
			expect(td.explain(helpersStubs.createSecret).callCount).to.equal(2);
			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeTemplates).calls[0].args[0]).to.equal(flowModule.ConfigFiles.helmOverride);
		});

		it('stops helm install when namespace creation fails', async () => {
			td.when(helpersStubs.createNamespace(td.matchers.anything(), td.matchers.anything()))
				.thenReject(new Error('namespace failed'));

			const installConfig = buildInstallConfig({ isDockerInstall: false, isHelmInstall: true });
			installConfig.gatewayConfig = {
				namespace: { name: 'amplify-agents', isNew: true },
				traceableToken: 'traceable-token',
				environments: [ 'traceable-dev' ],
				centralEnvironments: [ 'dev' ],
			};

			let error;
			try {
				await flowModule.completeInstall(installConfig);
			} catch (err) {
				error = err;
			}

			expect(error).to.be.instanceOf(Error);
			expect(error.message).to.equal('namespace failed');
			expect(td.explain(helpersStubs.createSecret).callCount).to.equal(0);
			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(0);
		});

		it('stops helm install when Traceable credentials secret creation fails', async () => {
			td.when(kubectlStubs.create(td.matchers.anything(), td.matchers.anything()))
				.thenResolve({ data: [ ], error: 'secret failed' });

			const installConfig = buildInstallConfig({ isDockerInstall: false, isHelmInstall: true });
			installConfig.gatewayConfig = {
				namespace: { name: 'amplify-agents', isNew: false },
				traceableToken: 'traceable-token',
				environments: [ 'traceable-dev' ],
				centralEnvironments: [ 'dev' ],
			};

			let error;
			try {
				await flowModule.completeInstall(installConfig);
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

function buildInstallConfig({ isDockerInstall = true, isHelmInstall = false } = {}) {
	return {
		log: () => {},
		switches: {
			isDockerInstall,
			isHelmInstall,
			isHostedInstall: false,
			isDaEnabled: false,
			isTaEnabled: true,
		},
		centralConfig: {
			apiServerClient: {},
			definitionManager: {},
			ampcEnvInfo: { name: 'installed-env' },
			ampcDosaInfo: { isNew: true },
			dosaAccount: { publicKey: 'pub.pem', privateKey: 'priv.pem' },
		},
		deploymentType: isHelmInstall ? 'Helm' : 'Dockerized',
		taVersion: '1.2.4',
		traceabilityConfig: {},
		gatewayConfig: {},
	};
}
