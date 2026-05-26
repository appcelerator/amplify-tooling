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
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/edgeAgents.js`;

describe('Edge Gateway on-prem agent flow', () => {
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
			askUsernameAndPassword: td.func('askUsernameAndPassword'),
		};
		await td.replaceEsm(BASIC_PROMPTS, promptStubs);

		const realHelpers = await import(AGENTS_INDEX);
		helpersStubs = {
			...realHelpers,
			askNamespace: td.func('askNamespace'),
			createNamespace: td.func('createNamespace'),
			createSecret: td.func('createSecret'),
			createAmplifyAgentKeysSecret: td.func('createAmplifyAgentKeysSecret'),
			createGatewayAgentCredsSecret: td.func('createGatewayAgentCredsSecret'),
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
			isWindows: false,
		};
		await td.replaceEsm(UTILS_MODULE, utilsStubs);

		td.when(kubectlStubs.isInstalled()).thenResolve({ error: null });
		td.when(promptStubs.askUsernameAndPassword(td.matchers.anything(), td.matchers.anything())).thenResolve({ username: 'user', password: 'pass' });
		td.when(helpersStubs.askNamespace(td.matchers.anything(), td.matchers.anything())).thenResolve({ name: 'amplify-agents', isNew: false });
		td.when(helpersStubs.createSecret(td.matchers.anything(), td.matchers.anything(), td.matchers.isA(Function))).thenDo((_ns, _secret, cb) => cb());
		td.when(helpersStubs.createAmplifyAgentKeysSecret(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(),
			td.matchers.anything(), td.matchers.anything())).thenResolve();
		td.when(helpersStubs.createGatewayAgentCredsSecret(td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(), td.matchers.anything(),
			td.matchers.anything(), td.matchers.anything())).thenResolve();

		flowModule = await import(FLOW_MODULE);
	});

	afterEach(() => td.reset());

	describe('EdgeInstallMethods metadata', () => {
		it('exports install methods with required hooks', () => {
			const methods = flowModule.EdgeInstallMethods;
			expect(methods).to.exist;
			expect(methods.GetBundleType).to.be.a('function');
			expect(methods.GetDeploymentType).to.be.a('function');
			expect(methods.AskGatewayQuestions).to.be.a('function');
			expect(methods.InstallPreprocess).to.be.a('function');
			expect(methods.FinalizeGatewayInstall).to.be.a('function');
			expect(methods.ConfigFiles).to.be.an('array').that.is.not.empty;
			expect(methods.GatewayDisplay).to.be.a('string').and.not.empty;
		});

		it('prompts deployment and bundle type in normal and gateway-only modes', async () => {
			td.when(promptStubs.askList(td.matchers.anything())).thenResolve('Dockerized');
			const configType = await flowModule.askConfigType();
			expect(configType).to.equal('Dockerized');

			td.reset();
			const realPrompts = await import(BASIC_PROMPTS);
			promptStubs = { ...realPrompts, askInput: td.func('askInput'), askList: td.func('askList'), askUsernameAndPassword: td.func('askUsernameAndPassword') };
			await td.replaceEsm(BASIC_PROMPTS, promptStubs);
			flowModule = await import(FLOW_MODULE);
			td.when(promptStubs.askList(td.matchers.anything())).thenResolve('Traceability offline mode');
			const gwOnlyBundle = await flowModule.askBundleTypeGWOnly();
			expect(gwOnlyBundle).to.equal('Traceability offline mode');
		});
	});

	describe('AskGatewayQuestions', () => {
		it('collects manager/gateway credentials and event log path for docker TA install', async () => {
			const askListResponses = [ 'Event' ];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());
			const askInputResponses = [ 'manager.local', '8075', 'gateway.local', '8090', '/apigateway/events/' ];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDockerInstall: true, isHelmInstall: false, isTaEnabled: true, isDaEnabled: true }));
			expect(result.apiManagerHost).to.equal('manager.local');
			expect(result.apiGatewayHost).to.equal('gateway.local');
			expect(result.eventLogPath).to.equal('/apigateway/events');
			expect(result.eventLogPathTemplate).to.equal('');
		});

		it('requires kubectl in helm mode', async () => {
			td.when(kubectlStubs.isInstalled()).thenResolve({ error: 'kubectl missing' });
			let error;
			try {
				await flowModule.gatewayConnectivity(buildInstallConfig({ isDockerInstall: false, isHelmInstall: true }));
			} catch (err) {
				error = err;
			}
			expect(error).to.be.instanceOf(Error);
			expect(error.message).to.include('Kubectl is required');
		});
	});

	describe('FinalizeGatewayInstall', () => {
		it('writes helm overrides and creates secrets in helm mode', async () => {
			const installConfig = buildInstallConfig({ isDockerInstall: false, isHelmInstall: true, isDaEnabled: true, isTaEnabled: true });
			installConfig.gatewayConfig = {
				namespace: { name: 'amplify-agents', isNew: true },
				apiManagerAuthUser: 'user',
				apiManagerAuthPass: 'pass',
				apiGatewayAuthUser: 'gw-user',
				apiGatewayAuthPass: 'gw-pass',
				eventLogPath: '/apigateway/events',
			};
			await flowModule.completeInstall(installConfig);
			expect(td.explain(helpersStubs.createNamespace).callCount).to.equal(1);
			expect(td.explain(helpersStubs.createSecret).callCount).to.equal(2);
			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(2);
		});

		it('writes DA/TA env files in docker mode', async () => {
			const installConfig = buildInstallConfig({ isDockerInstall: true, isHelmInstall: false, isDaEnabled: true, isTaEnabled: true });
			installConfig.gatewayConfig = { eventLogPath: '/apigateway/events' };
			await flowModule.completeInstall(installConfig);
			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(2);
			const files = td.explain(utilsStubs.writeTemplates).calls.map((call) => call.args[0]);
			expect(files).to.include(flowModule.ConfigFiles.DAEnvVars);
			expect(files).to.include(flowModule.ConfigFiles.TAEnvVars);
		});

		it('stops helm install when namespace creation fails', async () => {
			td.when(helpersStubs.createNamespace(td.matchers.anything(), td.matchers.anything()))
				.thenReject(new Error('namespace failed'));

			const installConfig = buildInstallConfig({ isDockerInstall: false, isHelmInstall: true, isDaEnabled: true, isTaEnabled: true });
			installConfig.gatewayConfig = {
				namespace: { name: 'amplify-agents', isNew: true },
				apiManagerAuthUser: 'user',
				apiManagerAuthPass: 'pass',
				apiGatewayAuthUser: 'gw-user',
				apiGatewayAuthPass: 'gw-pass',
				eventLogPath: '/apigateway/events',
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

		it('stops helm install when gateway credentials secret creation fails', async () => {
			td.when(helpersStubs.createGatewayAgentCredsSecret(
				td.matchers.anything(),
				td.matchers.anything(),
				td.matchers.anything(),
				td.matchers.anything(),
				td.matchers.anything(),
				td.matchers.anything(),
				td.matchers.anything()
			)).thenReject(new Error('creds failed'));

			const installConfig = buildInstallConfig({ isDockerInstall: false, isHelmInstall: true, isDaEnabled: true, isTaEnabled: true });
			installConfig.gatewayConfig = {
				namespace: { name: 'amplify-agents', isNew: false },
				apiManagerAuthUser: 'user',
				apiManagerAuthPass: 'pass',
				apiGatewayAuthUser: 'gw-user',
				apiGatewayAuthPass: 'gw-pass',
				eventLogPath: '/apigateway/events',
			};

			let error;
			try {
				await flowModule.completeInstall(installConfig);
			} catch (err) {
				error = err;
			}

			expect(error).to.be.instanceOf(Error);
			expect(error.message).to.equal('creds failed');
			expect(td.explain(helpersStubs.createSecret).callCount).to.equal(2);
			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(0);
		});
	});
});

function buildInstallConfig({ isDockerInstall = true, isHelmInstall = false, isDaEnabled = true, isTaEnabled = true } = {}) {
	return {
		log: () => {},
		switches: {
			isDockerInstall,
			isHelmInstall,
			isBinaryInstall: false,
			isHostedInstall: false,
			isGatewayOnly: false,
			isDaEnabled,
			isTaEnabled,
		},
		centralConfig: {
			apiServerClient: { account: { auth: { tokens: { access_token: 'token' } } } },
			definitionManager: {},
			ampcEnvInfo: { name: 'installed-env' },
			ampcDosaInfo: { isNew: true },
			dosaAccount: { publicKey: 'pub.pem', privateKey: 'priv.pem' },
		},
		bundleType: 'Traceability',
		deploymentType: isHelmInstall ? 'Helm' : 'Dockerized',
		daVersion: '1.2.3',
		taVersion: '1.2.4',
		traceabilityConfig: {},
		gatewayConfig: {},
	};
}
