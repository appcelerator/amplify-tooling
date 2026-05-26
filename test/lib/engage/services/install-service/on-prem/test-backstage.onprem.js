import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(__dirname, '../../../../../../dist');
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const UTILS_MODULE = `${distRoot}/lib/engage/utils/utils.js`;
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/backstageAgents.js`;

describe('Backstage on-prem agent flow', () => {
	let flowModule;
	let promptStubs;
	let utilsStubs;

	beforeEach(async () => {
		const realPrompts = await import(BASIC_PROMPTS);
		promptStubs = {
			...realPrompts,
			askInput: td.func('askInput'),
			askList: td.func('askList'),
		};
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

	describe('BackstageInstallMethods metadata', () => {
		it('exports install methods with required hooks', () => {
			const methods = flowModule.BackstageInstallMethods;
			expect(methods).to.exist;
			expect(methods.GetBundleType).to.be.a('function');
			expect(methods.GetDeploymentType).to.be.a('function');
			expect(methods.AskGatewayQuestions).to.be.a('function');
			expect(methods.FinalizeGatewayInstall).to.be.a('function');
			expect(methods.ConfigFiles).to.be.an('array').that.is.not.empty;
			expect(methods.GatewayDisplay).to.be.a('string').and.not.empty;
		});

		it('returns static discovery bundle and dockerized config type', async () => {
			const bundleType = await flowModule.askBundleType();
			const configType = await flowModule.askConfigType();

			expect(bundleType).to.equal('Discovery');
			expect(configType).to.exist;
		});
	});

	describe('AskGatewayQuestions', () => {
		it('collects static-token auth prompts', async () => {
			const askInputResponses = [ 'backstage.local', '7007', '/api', 'static-token-value' ];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const askListResponses = [ 'http', 'token' ];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig());

			expect(result.host).to.equal('backstage.local');
			expect(result.scheme).to.equal('http');
			expect(result.backendPort).to.equal('7007');
			expect(result.urlPath).to.equal('/api');
			expect(result.authMode).to.equal('token');
			expect(result.staticTokenValue).to.equal('static-token-value');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(4);
			expect(td.explain(promptStubs.askList).callCount).to.equal(2);
		});

		it('collects JWKS auth prompts', async () => {
			const askInputResponses = [ 'backstage.local', '', '', 'jwks-client-id', 'jwks-client-secret', 'https://token.url' ];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const askListResponses = [ 'https', 'jwks' ];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig());

			expect(result.authMode).to.equal('jwks');
			expect(result.jwksClientID).to.equal('jwks-client-id');
			expect(result.jwksClientSecret).to.equal('jwks-client-secret');
			expect(result.jwksTokenURL).to.equal('https://token.url');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(6);
		});

		it('does not ask auth credential prompts for guest mode', async () => {
			const askInputResponses = [ 'backstage.local', '', '' ];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const askListResponses = [ 'https', 'guest' ];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig());

			expect(result.authMode).to.equal('guest');
			expect(result.staticTokenValue).to.equal('');
			expect(result.jwksClientID).to.equal('');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(3);
		});

		it('stops prompting when JWKS credential collection fails', async () => {
			const askInputResponses = [ 'backstage.local', '', '', 'jwks-client-id' ];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => {
				if (askInputResponses.length > 0) {
					return askInputResponses.shift();
				}
				throw new Error('jwks failed');
			});

			const askListResponses = [ 'https', 'jwks' ];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			let error;
			try {
				await flowModule.gatewayConnectivity(buildInstallConfig());
			} catch (err) {
				error = err;
			}

			expect(error).to.be.instanceOf(Error);
			expect(error.message).to.equal('jwks failed');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(5);
		});
	});

	describe('FinalizeGatewayInstall', () => {
		it('writes DA template output and logs service-account guidance', async () => {
			const logs = [ ];
			const installConfig = buildInstallConfig({ logSink: logs });
			installConfig.gatewayConfig = {
				host: 'backstage.local',
				scheme: 'https',
				authMode: 'NoAuth',
			};

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeTemplates).calls[0].args[0]).to.equal(flowModule.ConfigFiles.DAEnvVars);
			expect(logs.some((line) => line.includes('private_key.pem'))).to.equal(true);
		});

		it('stops finalize when Backstage template generation fails', async () => {
			td.when(utilsStubs.writeTemplates(td.matchers.anything(), td.matchers.anything(), td.matchers.anything()))
				.thenDo(() => {
					throw new Error('write failed');
				});

			const installConfig = buildInstallConfig();
			installConfig.gatewayConfig = {
				host: 'backstage.local',
				scheme: 'https',
				authMode: 'NoAuth',
			};

			let error;
			try {
				await flowModule.completeInstall(installConfig);
			} catch (err) {
				error = err;
			}

			expect(error).to.be.instanceOf(Error);
			expect(error.message).to.equal('write failed');
		});
	});
});

function buildInstallConfig({ logSink = null } = {}) {
	const logs = logSink || [ ];
	return {
		log: (msg) => logs.push(String(msg)),
		switches: {
			isDockerInstall: true,
			isHelmInstall: false,
			isHostedInstall: false,
			isDaEnabled: true,
			isTaEnabled: false,
		},
		centralConfig: {
			apiServerClient: {},
			definitionManager: {},
			ampcEnvInfo: { name: 'installed-env' },
			ampcDosaInfo: { isNew: true },
			dosaAccount: { publicKey: 'pub.pem', privateKey: 'priv.pem' },
		},
		daVersion: '1.2.3',
		traceabilityConfig: {},
		gatewayConfig: {},
	};
}
