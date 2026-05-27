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
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/graylogAgents.js`;

describe('Graylog on-prem agent flow', () => {
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
			validateRegex: td.func('validateRegex'),
		};
		td.when(promptStubs.validateRegex(td.matchers.anything(), td.matchers.anything())).thenReturn(() => true);
		await td.replaceEsm(BASIC_PROMPTS, promptStubs);

		const realHelpers = await import(AGENTS_INDEX);
		helpersStubs = {
			...realHelpers,
			askNamespace: td.func('askNamespace'),
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
		td.when(helpersStubs.createSecret(td.matchers.anything(), td.matchers.anything(), td.matchers.isA(Function))).thenDo((_ns, _secret, cb) => cb());
		td.when(helpersStubs.createAmplifyAgentKeysSecret(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(),
			td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything())).thenResolve();

		flowModule = await import(FLOW_MODULE);
	});

	afterEach(() => td.reset());

	describe('GraylogInstallMethods metadata', () => {
		it('exports install methods with required hooks', () => {
			const methods = flowModule.GraylogInstallMethods;
			expect(methods).to.exist;
			expect(methods.GetBundleType).to.be.a('function');
			expect(methods.GetDeploymentType).to.be.a('function');
			expect(methods.AskGatewayQuestions).to.be.a('function');
			expect(methods.FinalizeGatewayInstall).to.be.a('function');
			expect(methods.ConfigFiles).to.be.an('array').that.is.not.empty;
			expect(methods.GatewayDisplay).to.be.a('string').and.not.empty;
		});

		it('returns static traceability bundle and helm deployment type', async () => {
			const bundleType = await flowModule.askBundleType();
			const configType = await flowModule.askConfigType();
			expect(bundleType).to.equal('Traceability');
			expect(configType).to.equal('Helm');
		});
	});

	describe('AskGatewayQuestions', () => {
		it('collects namespace and graylog credentials when kubectl is available', async () => {
			const askInputResponses = [ 'https://graylog.example.com', 'graylog-user', 'graylog-pass', 3 ];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig());

			expect(result.namespace.name).to.equal('amplify-agents');
			expect(result.url).to.equal('https://graylog.example.com');
			expect(result.userName).to.equal('graylog-user');
			expect(result.password).to.equal('graylog-pass');
			expect(result.basePathSegmentLen).to.equal(3);
			expect(td.explain(kubectlStubs.isInstalled).callCount).to.equal(1);
		});

		it('throws when kubectl is not installed', async () => {
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
	});

	describe('FinalizeGatewayInstall', () => {
		it('writes helm override and creates required secrets', async () => {
			const installConfig = buildInstallConfig();
			installConfig.gatewayConfig = {
				namespace: { name: 'amplify-agents', isNew: true },
				url: 'https://graylog.example.com',
				userName: 'graylog-user',
				password: 'graylog-pass',
				basePathSegmentLen: 2,
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

			const installConfig = buildInstallConfig();
			installConfig.gatewayConfig = {
				namespace: { name: 'amplify-agents', isNew: true },
				url: 'https://graylog.example.com',
				userName: 'graylog-user',
				password: 'graylog-pass',
				basePathSegmentLen: 2,
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

		it('stops helm install when Graylog credentials secret creation fails', async () => {
			td.when(kubectlStubs.create(td.matchers.anything(), td.matchers.anything()))
				.thenResolve({ data: [ ], error: 'secret failed' });

			const installConfig = buildInstallConfig();
			installConfig.gatewayConfig = {
				namespace: { name: 'amplify-agents', isNew: false },
				url: 'https://graylog.example.com',
				userName: 'graylog-user',
				password: 'graylog-pass',
				basePathSegmentLen: 2,
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

function buildInstallConfig() {
	return {
		log: () => {},
		switches: {
			isDockerInstall: false,
			isHelmInstall: true,
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
		deploymentType: 'Helm',
		taVersion: '1.2.4',
		traceabilityConfig: {},
		gatewayConfig: {},
	};
}
