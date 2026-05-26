import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(__dirname, '../../../../../../dist');
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const AGENTS_INDEX = `${distRoot}/lib/engage/utils/agents/index.js`;
const KUBECTL_MODULE = `${distRoot}/lib/engage/utils/agents/kubectl.js`;
const UTILS_MODULE = `${distRoot}/lib/engage/utils/utils.js`;
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/istioAgents.js`;

describe('Istio on-prem agent flow', () => {
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
			validateRegex: td.func('validateRegex'),
		};
		td.when(promptStubs.validateRegex(td.matchers.anything(), td.matchers.anything())).thenReturn(() => true);
		await td.replaceEsm(BASIC_PROMPTS, promptStubs);

		const realHelpers = await import(AGENTS_INDEX);
		helpersStubs = {
			...realHelpers,
			askNamespace: td.func('askNamespace'),
			askClusterName: td.func('askClusterName'),
			createNamespace: td.func('createNamespace'),
			createSecret: td.func('createSecret'),
			createAmplifyAgentKeysSecret: td.func('createAmplifyAgentKeysSecret'),
		};
		await td.replaceEsm(AGENTS_INDEX, helpersStubs);

		kubectlStubs = {
			isInstalled: td.func('kubectl.isInstalled'),
			create: td.func('kubectl.create'),
			get: td.func('kubectl.get'),
		};
		await td.replaceEsm(KUBECTL_MODULE, { kubectl: kubectlStubs });

		const realUtils = await import(UTILS_MODULE);
		utilsStubs = {
			...realUtils,
			writeTemplates: td.func('writeTemplates'),
		};
		await td.replaceEsm(UTILS_MODULE, utilsStubs);

		td.when(kubectlStubs.isInstalled()).thenResolve({ error: null });
		td.when(kubectlStubs.get('namespaces')).thenResolve({ data: [ 'default', 'istio-system' ], error: null });
		td.when(kubectlStubs.get('ns')).thenResolve({ data: [ 'default', 'ampc-demo' ], error: null });
		td.when(kubectlStubs.get('secrets', td.matchers.anything())).thenResolve({ data: [], error: '' });
		td.when(kubectlStubs.create(td.matchers.anything(), td.matchers.anything())).thenResolve({ data: [ 'created' ], error: null });
		td.when(helpersStubs.askNamespace(td.matchers.anything(), td.matchers.anything())).thenResolve({ name: 'amplify-agents', isNew: false });
		td.when(helpersStubs.askClusterName()).thenResolve('cluster-1');
		td.when(helpersStubs.createSecret(td.matchers.anything(), td.matchers.anything(), td.matchers.isA(Function))).thenDo((_ns, _secret, cb) => cb());
		td.when(helpersStubs.createAmplifyAgentKeysSecret(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(),
			td.matchers.anything(), td.matchers.anything())).thenResolve();

		flowModule = await import(FLOW_MODULE);
	});

	afterEach(() => td.reset());

	describe('IstioInstallMethods metadata', () => {
		it('exports install methods with required hooks', () => {
			const methods = flowModule.IstioInstallMethods;
			expect(methods).to.exist;
			expect(methods.GetBundleType).to.be.a('function');
			expect(methods.GetDeploymentType).to.be.a('function');
			expect(methods.AskGatewayQuestions).to.be.a('function');
			expect(methods.InstallPreprocess).to.be.a('function');
			expect(methods.FinalizeGatewayInstall).to.be.a('function');
			expect(methods.ConfigFiles).to.be.an('array').that.is.not.empty;
			expect(methods.GatewayDisplay).to.be.a('string').and.not.empty;
		});

		it('prompts bundle type and returns dockerized config type', async () => {
			td.when(promptStubs.askList(td.matchers.anything())).thenResolve('All Agents');
			const bundleType = await flowModule.askBundleType();
			const configType = await flowModule.askConfigType();
			expect(bundleType).to.equal('All Agents');
			expect(configType).to.equal('Dockerized');
		});
	});

	describe('AskGatewayQuestions', () => {
		it('collects existing-istio and kubernetes setup prompts', async () => {
			const askListResponses = [ 'Yes', 'default', 'Ambient', 'default', 'No' ];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true, isTaEnabled: true }));
			expect(result.istioInstallValues.isNewInstall).to.equal(false);
			expect(result.istioInstallValues.envoyFilterNamespace).to.equal('default');
			expect(result.istioAgentValues.namespace.name).to.equal('amplify-agents');
			expect(result.istioAgentValues.clusterName).to.equal('cluster-1');
		});

		it('throws when kubectl is unavailable', async () => {
			td.when(kubectlStubs.isInstalled()).thenResolve({ error: 'kubectl missing' });
			let error;
			try {
				await flowModule.gatewayConnectivity(buildInstallConfig());
			} catch (err) {
				error = err;
			}
			expect(error).to.be.instanceOf(Error);
			expect(error.message).to.include('Kubectl is required');
		});

		it('throws when kubernetes namespace lookup fails during discovery setup', async () => {
			td.when(kubectlStubs.get('ns')).thenResolve({ data: [ ], error: 'namespace query failed' });

			const askListResponses = [ 'Yes', 'default', 'Ambient' ];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			let error;
			try {
				await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true, isTaEnabled: true }));
			} catch (err) {
				error = err;
			}

			expect(error).to.be.instanceOf(Error);
			expect(error.message).to.equal('namespace query failed');
		});
	});

	describe('FinalizeGatewayInstall', () => {
		it('creates namespace/secret and writes istio + hybrid override files', async () => {
			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: true });
			installConfig.gatewayConfig = {
				istioInstallValues: {
					isNewInstall: false,
					protocol: 'http',
					envoyFilterNamespace: 'default',
				},
				istioAgentValues: {
					namespace: { name: 'amplify-agents', isNew: true },
					alsEnabled: true,
					discoveryEnabled: true,
					discoveryNamespaces: [ 'default' ],
					clusterName: 'cluster-1',
				},
			};
			await flowModule.completeInstall(installConfig);
			expect(td.explain(helpersStubs.createNamespace).callCount).to.equal(1);
			expect(td.explain(helpersStubs.createSecret).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(2);
		});

		it('stops finalize when namespace creation fails', async () => {
			td.when(helpersStubs.createNamespace(td.matchers.anything(), td.matchers.anything()))
				.thenReject(new Error('namespace failed'));

			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: true });
			installConfig.gatewayConfig = {
				istioInstallValues: {
					isNewInstall: false,
					protocol: 'http',
					envoyFilterNamespace: 'default',
				},
				istioAgentValues: {
					namespace: { name: 'amplify-agents', isNew: true },
					alsEnabled: true,
					discoveryEnabled: true,
					discoveryNamespaces: [ 'default' ],
					clusterName: 'cluster-1',
				},
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

		it('stops finalize when Amplify key secret creation fails', async () => {
			td.when(helpersStubs.createAmplifyAgentKeysSecret(
				td.matchers.anything(),
				td.matchers.anything(),
				td.matchers.anything(),
				td.matchers.anything(),
				td.matchers.anything(),
				td.matchers.anything(),
				td.matchers.anything()
			)).thenReject(new Error('keys failed'));

			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: true });
			installConfig.gatewayConfig = {
				istioInstallValues: {
					isNewInstall: false,
					protocol: 'http',
					envoyFilterNamespace: 'default',
				},
				istioAgentValues: {
					namespace: { name: 'amplify-agents', isNew: false },
					alsEnabled: true,
					discoveryEnabled: true,
					discoveryNamespaces: [ 'default' ],
					clusterName: 'cluster-1',
				},
			};

			let error;
			try {
				await flowModule.completeInstall(installConfig);
			} catch (err) {
				error = err;
			}

			expect(error).to.be.instanceOf(Error);
			expect(error.message).to.equal('keys failed');
			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(0);
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
			ampcDosaInfo: { isNew: true },
			dosaAccount: { publicKey: 'pub.pem', privateKey: 'priv.pem' },
		},
		deploymentType: 'Dockerized',
		daVersion: '1.2.3',
		taVersion: '1.2.4',
		traceabilityConfig: {},
		gatewayConfig: {},
	};
}
