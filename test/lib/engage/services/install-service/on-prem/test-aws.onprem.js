import { expect } from 'chai';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = pathToFileURL(path.resolve(__dirname, '../../../../../../dist')).href;
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const AGENTS_INDEX  = `${distRoot}/lib/engage/utils/agents/index.js`;
const UTILS_MODULE = `${distRoot}/lib/engage/utils/utils.js`;
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/awsAgents.js`;

describe('AWS on-prem agent flow', () => {
	let flowModule;
	let promptStubs;
	let helpersStubs;
	let utilsStubs;

	beforeEach(async () => {
		promptStubs = {
			askInput: td.func('askInput'),
			askList: td.func('askList'),
			validateRegex: td.func('validateRegex'),
			validateInputLength: td.func('validateInputLength'),
		};
		td.when(promptStubs.validateRegex(td.matchers.anything(), td.matchers.anything())).thenReturn(() => true);
		td.when(promptStubs.validateInputLength(td.matchers.anything(), td.matchers.anything())).thenReturn(() => true);
		await td.replaceEsm(BASIC_PROMPTS, promptStubs);

		helpersStubs = createHelpersStubs();
		await td.replaceEsm(AGENTS_INDEX, helpersStubs);

		const realUtils = await import(UTILS_MODULE);
		utilsStubs = {
			...realUtils,
			writeTemplates: td.func('writeTemplates'),
			isWindows: false,
		};
		await td.replaceEsm(UTILS_MODULE, utilsStubs);

		td.when(helpersStubs.askAWSRegion()).thenResolve('us-east-1');

		flowModule = await import(FLOW_MODULE);
	});

	afterEach(() => td.reset());

	describe('AWSInstallMethods metadata', () => {
		it('exports install methods with required hooks', () => {
			const methods = flowModule.AWSInstallMethods;
			expect(methods).to.exist;
			expect(methods.GetBundleType).to.be.a('function');
			expect(methods.GetDeploymentType).to.be.a('function');
			expect(methods.AskGatewayQuestions).to.be.a('function');
			expect(methods.FinalizeGatewayInstall).to.be.a('function');
			expect(methods.InstallPreprocess).to.equal(undefined);
			expect(methods.ConfigFiles).to.be.an('array').that.is.not.empty;
			expect(methods.ConfigFiles).to.not.include('cloudformation_properties.json');
			expect(methods.GatewayDisplay).to.be.a('string').and.not.empty;
		});

		it('returns static bundle and config types', async () => {
			const bundle = await flowModule.askBundleType();
			const config = await flowModule.askConfigType();
			expect(bundle).to.exist;
			expect(config).to.exist;
			expect(td.explain(promptStubs.askList).callCount).to.equal(0);
		});
	});

	describe('AskGatewayQuestions', () => {
		it('collects API Gateway mode prompts', async () => {
			const askListResponses = [
				'No',    // AGENT_CORE_GATEWAY_MODE
				'No',    // fullTransactionLogging
			];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const askInputResponses = [
				'/aws/apigw/logs',
				'stage-tag',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true, isTaEnabled: true }));

			expect(result.agentCoreGatewayMode).to.equal(false);
			expect(result.logGroup).to.equal('/aws/apigw/logs');
			expect(result.stageTagName).to.equal('stage-tag');
			expect(result.fullTransactionLogging).to.equal(false);
			expect(result.region).to.equal('us-east-1');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(2);
			expect(td.explain(promptStubs.askList).callCount).to.equal(2);
		});

		it('enables agentcore gateway mode and collects a single cognito pool', async () => {
			const askListResponses = [
				'Yes',   // AGENT_CORE_GATEWAY_MODE
				'Yes',   // iamAuthEnabled
				'No',    // enterMore?
				'Yes',   // AGENTCORE_CLOUDTRAILENABLED
			];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const askInputResponses = [
				'us-east-1_123456789',
				'/aws/prefix',
				'my-cloudtrail-bucket',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true, isTaEnabled: true }));

			expect(result.agentCoreGatewayMode).to.equal(true);
			expect(result.agentCore.logGroupPrefix).to.equal('/aws/prefix');
			expect(result.agentCore.iamAuthEnabled).to.equal(true);
			expect(result.cognitoUserPoolIDs).to.have.length(1);
			expect(result.cognitoUserPoolIDs[0]).to.equal('us-east-1_123456789');
			expect(result.agentCore.cloudTrailEnabled).to.equal(true);
			expect(result.agentCore.cloudTrailBucket).to.equal('my-cloudtrail-bucket');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(3);
			expect(td.explain(promptStubs.askList).callCount).to.equal(4);
		});

		it('skips the log group prefix and CloudTrail prompts when TA is not enabled', async () => {
			const askListResponses = [
				'Yes',   // AGENT_CORE_GATEWAY_MODE
				'No',    // iamAuthEnabled
				'No',    // enterMore?
			];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const askInputResponses = [
				'us-east-1_999999999',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true, isTaEnabled: false }));

			expect(result.agentCoreGatewayMode).to.equal(true);
			expect(result.agentCore.logGroupPrefix).to.equal('');
			expect(result.agentCore.cloudTrailEnabled).to.equal(false);
			expect(result.agentCore.cloudTrailBucket).to.equal('');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(1);
			expect(td.explain(promptStubs.askList).callCount).to.equal(3);
		});

		it('enables agentcore gateway mode and collects multiple cognito pools', async () => {
			const askListResponses = [
				'Yes',   // AGENT_CORE_GATEWAY_MODE
				'No',    // iamAuthEnabled
				'Yes',   // enterMore? (add another pool)
				'No',    // enterMore?
				'No',    // AGENTCORE_CLOUDTRAILENABLED
			];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const askInputResponses = [
				'us-east-1_111111111',
				'eu-west-1_222222222',
				'',
				'my-bucket-2',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true, isTaEnabled: true }));

			expect(result.agentCoreGatewayMode).to.equal(true);
			expect(result.agentCore.logGroupPrefix).to.equal('');
			expect(result.agentCore.iamAuthEnabled).to.equal(false);
			expect(result.cognitoUserPoolIDs).to.have.length(2);
			expect(result.cognitoUserPoolIDs[0]).to.equal('us-east-1_111111111');
			expect(result.cognitoUserPoolIDs[1]).to.equal('eu-west-1_222222222');
			expect(result.agentCore.cloudTrailEnabled).to.equal(false);
			expect(result.agentCore.cloudTrailBucket).to.equal('my-bucket-2');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(4);
			expect(td.explain(promptStubs.askList).callCount).to.equal(5);
		});

		it('stops question flow when AWS region lookup fails', async () => {
			td.when(helpersStubs.askAWSRegion()).thenReject(new Error('region failed'));

			let error;
			try {
				await flowModule.gatewayConnectivity(buildInstallConfig());
			} catch (err) {
				error = err;
			}

			expect(error).to.be.instanceOf(Error);
			expect(error.message).to.equal('region failed');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(0);
			expect(td.explain(promptStubs.askList).callCount).to.equal(0);
		});
	});

	describe('FinalizeGatewayInstall', () => {
		it('writes DA and TA templates when both agents are enabled', async () => {
			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: true });
			installConfig.gatewayConfig = buildGatewayConfig(helpersStubs);

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(2);
			const writeTemplatesArgs = td.explain(utilsStubs.writeTemplates).calls.map((call) => call.args[0]);
			expect(writeTemplatesArgs).to.include(flowModule.ConfigFiles.DAEnvVars);
			expect(writeTemplatesArgs).to.include(flowModule.ConfigFiles.TAEnvVars);
		});

		it('writes only the DA template when TA is disabled', async () => {
			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: false });
			installConfig.gatewayConfig = buildGatewayConfig(helpersStubs);

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeTemplates).calls[0].args[0]).to.equal(flowModule.ConfigFiles.DAEnvVars);
		});

		it('writes only the TA template when DA is disabled', async () => {
			const installConfig = buildInstallConfig({ isDaEnabled: false, isTaEnabled: true });
			installConfig.gatewayConfig = buildGatewayConfig(helpersStubs);

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeTemplates).calls[0].args[0]).to.equal(flowModule.ConfigFiles.TAEnvVars);
		});

		it('builds the docker image path using the major.minor dockerRepoVersion', async () => {
			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: true });
			installConfig.dockerRepoVersion = '1.2';
			installConfig.daVersion = '1.2.3';
			installConfig.taVersion = '1.2.4';
			installConfig.gatewayConfig = buildGatewayConfig(helpersStubs);

			const logs = [];
			installConfig.log = (msg) => logs.push(String(msg));

			await flowModule.completeInstall(installConfig);

			const output = logs.join('\n');
			expect(output).to.include('/1.2/');
			expect(output).to.include(':1.2.3');
			expect(output).to.include(':1.2.4');
		});
	});
});

function createHelpersStubs() {
	class AWSAgentValues {
		constructor() {
			this.accessKey = '**Insert Access Key**';
			this.secretKey = '**Insert Secret Key**';
			this.logGroup = '';
			this.stageTagName = '';
			this.fullTransactionLogging = false;
			this.region = '';
			this.apigwAgentConfigZipFile = '';
			this.centralConfig = {};
			this.traceabilityConfig = {};
			this.agentCoreGatewayMode = false;
			this.agentCore = { logGroupPrefix: '', iamAuthEnabled: false, cloudTrailEnabled: false, cloudTrailBucket: '' };
			this.cognitoUserPoolIDs = [];
		}
	}

	return {
		AWSAgentValues,
		AWSAgentCoreConfig: class AWSAgentCoreConfig {
			constructor(logGroupPrefix, iamAuthEnabled, cloudTrailEnabled, cloudTrailBucket) {
				this.logGroupPrefix = logGroupPrefix ?? '';
				this.iamAuthEnabled = iamAuthEnabled ?? false;
				this.cloudTrailEnabled = cloudTrailEnabled ?? false;
				this.cloudTrailBucket = cloudTrailBucket ?? '';
			}
		},
		AWSRegexPatterns: {
			AWS_REGEXP_LOG_GROUP_NAME: /.*/,
		},
		agentsDocsUrl: {
			AWS: 'https://docs.example/aws',
		},
		askAWSRegion: td.func('askAWSRegion'),
		awsDAEnvVarTemplate: 'DA_TEMPLATE',
		awsTAEnvVarTemplate: 'TA_TEMPLATE',
		configFiles: {
			DA_ENV_VARS: 'da_env_vars.env',
			TA_ENV_VARS: 'ta_env_vars.env',
		},
		eolChar: '\\',
		eolCharWin: '^',
		pwd: '/tmp',
		pwdWin: 'C:\\\\tmp',
	};
}

function buildInstallConfig({
	isDaEnabled = true,
	isTaEnabled = true,
	logSink = null,
} = {}) {
	const logs = logSink || [ ];
	return {
		log: (msg) => logs.push(String(msg)),
		switches: {
			isDockerInstall: true,
			isHelmInstall: false,
			isHostedInstall: false,
			isDaEnabled,
			isTaEnabled,
		},
		centralConfig: {
			apiServerClient: {
				account: {
					auth: {
						tokens: {
							access_token: 'token',
						},
					},
				},
			},
			definitionManager: {},
			ampcEnvInfo: { name: 'installed-env' },
			ampcDosaInfo: { isNew: false },
			dosaAccount: { publicKey: 'pub.pem', privateKey: 'priv.pem' },
		},
		daVersion: '1.2.3',
		taVersion: '1.2.4',
		dockerRepoVersion: '1.2',
		traceabilityConfig: {},
		gatewayConfig: {},
	};
}

function buildGatewayConfig(helpersStubs, region = 'us-east-1') {
	const gatewayConfig = new helpersStubs.AWSAgentValues();
	gatewayConfig.region = region;
	return gatewayConfig;
}
