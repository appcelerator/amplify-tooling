import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(__dirname, '../../../../../../dist');
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const UTILS_MODULE = `${distRoot}/lib/engage/utils/utils.js`;
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/kafkaAgents.js`;

describe('Kafka on-prem agent flow', () => {
	let flowModule;
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

		flowModule = await import(FLOW_MODULE);
	});

	afterEach(() => td.reset());

	describe('KafkaInstallMethods metadata', () => {
		it('exports install methods with required hooks', () => {
			const methods = flowModule.KafkaInstallMethods;
			expect(methods).to.exist;
			expect(methods.GetBundleType).to.be.a('function');
			expect(methods.GetDeploymentType).to.be.a('function');
			expect(methods.AskGatewayQuestions).to.be.a('function');
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
		it('collects confluent cloud prompts and schema registry keys', async () => {
			const askListResponses = [ 'Confluent Cloud' ];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const askInputResponses = [
				'env-id',
				'cluster-id',
				'cloud-key',
				'cloud-secret',
				'cluster-key',
				'cluster-secret',
				'schema-key',
				'schema-secret',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true }));
			expect(result.cloudEnabled).to.equal(true);
			expect(result.cloudEnvironmentId).to.equal('env-id');
			expect(result.cloudClusterId).to.equal('cluster-id');
			expect(result.schemaRegistryAPIKey).to.equal('schema-key');
		});

		it('collects confluent platform prompts with oauth sasl and schema registry auth', async () => {
			const askListResponses = [
				'Confluent Platform',
				'OAUTHBEARER',
				'Yes',
				'Yes',
			];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const askInputResponses = [
				'SASL_SSL://kafka.example.com:9092',
				'https://oauth.token.url',
				'oauth-client-id',
				'oauth-client-secret',
				'scope1,scope2',
				'https://schema-registry.example.com',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true }));
			expect(result.cloudEnabled).to.equal(false);
			expect(result.clusterServer).to.equal('SASL_SSL://kafka.example.com:9092');
			expect(result.clusterSaslMechanism).to.equal('OAUTHBEARER');
			expect(result.saslOauthTokenUrl).to.equal('https://oauth.token.url');
			expect(result.schemaRegistryEnabled).to.equal(true);
			expect(result.schemaRegistryAuthEnabled).to.equal(true);
		});

		it('wires bootstrap server, oauth token URL, and schema registry URL validators into the prompt config', async () => {
			const validator = () => true;
			td.when(promptStubs.validateRegex(td.matchers.anything(), td.matchers.anything())).thenReturn(validator);

			const promptConfigs = [ ];
			const askListResponses = [
				'Confluent Platform',
				'OAUTHBEARER',
				'Yes',
				'Yes',
			];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());
			const askInputResponses = [
				'SASL_SSL://kafka.example.com:9092',
				'https://oauth.token.url',
				'oauth-client-id',
				'oauth-client-secret',
				'scope1,scope2',
				'https://schema-registry.example.com',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo((config) => {
				promptConfigs.push(config);
				return askInputResponses.shift();
			});

			await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true }));

			expect(promptConfigs.find((config) => config.msg === 'Enter the Bootstrap Server Name').validate).to.equal(validator);
			expect(promptConfigs.find((config) => config.msg === 'Enter the SASL/OAUTHBEARER Token Url').validate).to.equal(validator);
			expect(promptConfigs.find((config) => config.msg === 'Enter the Schema Registry Url').validate).to.equal(validator);
			expect(td.explain(promptStubs.validateRegex).callCount).to.equal(3);
		});
	});

	describe('FinalizeGatewayInstall', () => {
		it('writes DA and TA templates when both are enabled', async () => {
			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: true });
			installConfig.gatewayConfig = {};
			await flowModule.completeInstall(installConfig);
			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(2);
			const files = td.explain(utilsStubs.writeTemplates).calls.map((call) => call.args[0]);
			expect(files).to.include(flowModule.ConfigFiles.DAEnvVars);
			expect(files).to.include(flowModule.ConfigFiles.TAEnvVars);
		});

		it('writes only TA template when DA is disabled', async () => {
			const installConfig = buildInstallConfig({ isDaEnabled: false, isTaEnabled: true });
			installConfig.gatewayConfig = {};
			await flowModule.completeInstall(installConfig);
			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeTemplates).calls[0].args[0]).to.equal(flowModule.ConfigFiles.TAEnvVars);
		});

		it('stops finalize when Kafka template generation fails', async () => {
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
			ampcDosaInfo: { isNew: false },
			dosaAccount: { publicKey: 'pub.pem', privateKey: 'priv.pem' },
		},
		deploymentType: 'Dockerized',
		daVersion: '1.2.3',
		taVersion: '1.2.4',
		traceabilityConfig: {},
		gatewayConfig: {},
	};
}
