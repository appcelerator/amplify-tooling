import { expect } from 'chai';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = pathToFileURL(path.resolve(__dirname, '../../../../../../dist')).href;
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const AGENTS_INDEX  = `${distRoot}/lib/engage/utils/agents/index.js`;
const REQUEST_MODULE = `${distRoot}/lib/request.js`;
const UTILS_MODULE = `${distRoot}/lib/engage/utils/utils.js`;
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/awsAgents.js`;

describe('AWS on-prem agent flow', () => {
	let flowModule;
	let promptStubs;
	let helpersStubs;
	let requestStubs;
	let utilsStubs;
	let fsStubs;

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

		requestStubs = {
			dataService: td.func('dataService'),
		};
		await td.replaceEsm(REQUEST_MODULE, requestStubs);

		const realUtils = await import(UTILS_MODULE);
		utilsStubs = {
			...realUtils,
			writeToFile: td.func('writeToFile'),
			writeTemplates: td.func('writeTemplates'),
			isWindows: false,
		};
		await td.replaceEsm(UTILS_MODULE, utilsStubs);

		fsStubs = {
			createWriteStream: td.func('createWriteStream'),
			existsSync: td.func('existsSync'),
			unlinkSync: td.func('unlinkSync'),
		};
		await td.replaceEsm('fs', { default: fsStubs, ...fsStubs });

		td.when(helpersStubs.askAWSRegion()).thenResolve('us-east-1');
		td.when(fsStubs.existsSync(td.matchers.anything())).thenReturn(true);
		td.when(fsStubs.createWriteStream(td.matchers.anything())).thenReturn({});
		td.when(requestStubs.dataService(td.matchers.anything())).thenResolve({
			download: td.func('download'),
		});

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
			expect(methods.InstallPreprocess).to.be.a('function');
			expect(methods.FinalizeGatewayInstall).to.be.a('function');
			expect(methods.ConfigFiles).to.be.an('array').that.is.not.empty;
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
		it('collects EC2 values and includes VPC-derived prompts when VPC is set', async () => {
			const askListResponses = [
				flowModule.DeploymentTypes.EC2,
				'No',    // AGENT_CORE_GATEWAY_MODE
				'Yes',   // APIGWCWRoleSetup
				'No',    // fullTransactionLogging
				't3.micro',
				'Yes',   // PUBLIC_IP
			];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const askInputResponses = [
				'agents-bucket',
				'/aws/apigw/logs',
				'stage-tag',
				'my-key',
				'vpc-1234567890abcdef',
				'sg-1234567890abcdef',
				'subnet-1234567890abcdef',
				'10.0.0.0/24',
				'/ssm/private',
				'/ssm/public',
				'/aws/da/logs',
				'/aws/ta/logs',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true, isTaEnabled: true }));

			expect(result.cloudFormationConfig.DeploymentType).to.equal(flowModule.DeploymentTypes.EC2);
			expect(result.cloudFormationConfig.EC2VPCID).to.equal('vpc-1234567890abcdef');
			expect(result.cloudFormationConfig.SecurityGroup).to.equal('sg-1234567890abcdef');
			expect(result.cloudFormationConfig.Subnet).to.equal('subnet-1234567890abcdef');
			expect(result.logGroup).to.equal('/aws/apigw/logs');
			expect(result.stageTagName).to.equal('stage-tag');
			expect(result.fullTransactionLogging).to.equal(false);
			expect(result.agentCoreGatewayMode).to.equal(false);
			expect(td.explain(promptStubs.askInput).callCount).to.equal(12);
			expect(td.explain(promptStubs.askList).callCount).to.equal(6);
		});

		it('skips VPC-derived prompts when EC2 VPC is empty', async () => {
			const askListResponses = [
				flowModule.DeploymentTypes.EC2,
				'No',    // AGENT_CORE_GATEWAY_MODE
				'Yes',   // APIGWCWRoleSetup
				'No',    // fullTransactionLogging
				't3.micro',
			];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const askInputResponses = [
				'agents-bucket',
				'/aws/apigw/logs',
				'stage-tag',
				'my-key',
				'',
				'0.0.0.0/0',
				'/ssm/private',
				'/ssm/public',
				'/aws/da/logs',
				'/aws/ta/logs',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ isDaEnabled: true, isTaEnabled: true }));

			expect(result.cloudFormationConfig.EC2VPCID).to.equal('');
			expect(result.cloudFormationConfig.SecurityGroup).to.equal('');
			expect(result.cloudFormationConfig.Subnet).to.equal('');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(10);
			expect(td.explain(promptStubs.askList).callCount).to.equal(5);
		});

		it('collects ECS-only deployment prompts', async () => {
			const askListResponses = [
				flowModule.DeploymentTypes.ECS_FARGATE,
				'No',    // AGENT_CORE_GATEWAY_MODE
				'Yes',   // APIGWCWRoleSetup
				'No',    // fullTransactionLogging
			];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const askInputResponses = [
				'agents-bucket',
				'/aws/apigw/logs',
				'stage-tag',
				'ecs-cluster',
				'sg-1234567890abcdef',
				'subnet-1234567890abcdef',
				'/ssm/private',
				'/ssm/public',
				'/aws/da/logs',
				'/aws/ta/logs',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const logs = [ ];
			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ logSink: logs }));

			expect(result.cloudFormationConfig.DeploymentType).to.equal(flowModule.DeploymentTypes.ECS_FARGATE);
			expect(result.cloudFormationConfig.ECSClusterName).to.equal('ecs-cluster');
			expect(result.cloudFormationConfig.EC2KeyName).to.equal('');
			expect(logs.some((line) => line.includes('ECS Cluster Name'))).to.equal(true);
			expect(td.explain(promptStubs.askInput).callCount).to.equal(10);
			expect(td.explain(promptStubs.askList).callCount).to.equal(4);
		});

		it('collects minimal prompts for OTHER deployment type', async () => {
			const askListResponses = [
				flowModule.DeploymentTypes.OTHER,
				'No',    // AGENT_CORE_GATEWAY_MODE
				'Yes',   // APIGWCWRoleSetup
				'No',    // fullTransactionLogging
			];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const askInputResponses = [
				'agents-bucket',
				'/aws/apigw/logs',
				'stage-tag',
				'/aws/da/logs',
				'/aws/ta/logs',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const logs = [ ];
			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ logSink: logs }));

			expect(result.cloudFormationConfig.DeploymentType).to.equal(flowModule.DeploymentTypes.OTHER);
			expect(result.cloudFormationConfig.EC2KeyName).to.equal('');
			expect(result.cloudFormationConfig.ECSClusterName).to.equal('');
			expect(logs.some((line) => line.includes('AWS Access Key'))).to.equal(true);
			expect(td.explain(promptStubs.askInput).callCount).to.equal(5);
			expect(td.explain(promptStubs.askList).callCount).to.equal(4);
		});

		it('enables agentcore gateway mode and collects a single cognito pool', async () => {
			const askListResponses = [
				flowModule.DeploymentTypes.OTHER,
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
			expect(td.explain(promptStubs.askList).callCount).to.equal(5);
		});

		it('skips the log group prefix and CloudTrail prompts when TA is not enabled', async () => {
			const askListResponses = [
				flowModule.DeploymentTypes.OTHER,
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
			expect(td.explain(promptStubs.askList).callCount).to.equal(4);
		});

		it('enables agentcore gateway mode and collects multiple cognito pools', async () => {
			const askListResponses = [
				flowModule.DeploymentTypes.OTHER,
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
			expect(td.explain(promptStubs.askList).callCount).to.equal(6);
		});

		it('stops question flow when AWS region lookup fails', async () => {
			td.when(helpersStubs.askAWSRegion()).thenReject(new Error('region failed'));

			const askListResponses = [ flowModule.DeploymentTypes.EC2 ];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			let error;
			try {
				await flowModule.gatewayConnectivity(buildInstallConfig());
			} catch (err) {
				error = err;
			}

			expect(error).to.be.instanceOf(Error);
			expect(error.message).to.equal('region failed');
			expect(td.explain(promptStubs.askInput).callCount).to.equal(0);
		});
	});

	describe('InstallPreprocess', () => {
		it('downloads latest AWS config zip and stores file name on gateway config', async () => {
			const download = td.func('download');
			td.when(requestStubs.dataService(td.matchers.anything())).thenResolve({ download });
			td.when(download(td.matchers.anything())).thenResolve({ stream: {} });
			td.when(helpersStubs.streamPipeline(td.matchers.anything(), td.matchers.anything())).thenResolve();

			const installConfig = buildInstallConfig();
			installConfig.gatewayConfig = new helpersStubs.AWSAgentValues(flowModule.DeploymentTypes.EC2);

			const result = await flowModule.installPreprocess(installConfig);

			expect(result.gatewayConfig.apigwAgentConfigZipFile).to.equal(flowModule.ConfigFiles.AgentConfigZip);
			expect(td.explain(download).callCount).to.equal(1);
			expect(td.explain(helpersStubs.streamPipeline).callCount).to.equal(1);
		});

		it('throws when account is not present in install config', async () => {
			const installConfig = buildInstallConfig();
			installConfig.centralConfig.apiServerClient = {};
			installConfig.gatewayConfig = new helpersStubs.AWSAgentValues(flowModule.DeploymentTypes.EC2);

			let error;
			try {
				await flowModule.installPreprocess(installConfig);
			} catch (err) {
				error = err;
			}

			expect(error).to.be.instanceOf(Error);
			expect(error.message).to.include('Unable to resolve account');
		});

		it('throws when AWS config zip download fails', async () => {
			const download = td.func('download');
			td.when(requestStubs.dataService(td.matchers.anything())).thenResolve({ download });
			td.when(download(td.matchers.anything())).thenReject(new Error('download failed'));

			const installConfig = buildInstallConfig();
			installConfig.gatewayConfig = new helpersStubs.AWSAgentValues(flowModule.DeploymentTypes.EC2);

			let error;
			try {
				await flowModule.installPreprocess(installConfig);
			} catch (err) {
				error = err;
			}

			expect(error).to.be.instanceOf(Error);
			expect(error.message).to.equal('Failed to download the agent: download failed');
			expect(td.explain(helpersStubs.streamPipeline).callCount).to.equal(0);
		});
	});

	describe('FinalizeGatewayInstall', () => {
		it('writes CF + DA/TA templates and cleans Fargate file for EC2 deployment', async () => {
			td.when(fsStubs.existsSync(td.matchers.anything())).thenReturn(true);
			td.when(helpersStubs.unzip(td.matchers.anything())).thenResolve();

			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: true });
			installConfig.gatewayConfig = buildGatewayConfig(helpersStubs, flowModule.DeploymentTypes.EC2);

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeToFile).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeToFile).calls[0].args[0]).to.equal(flowModule.ConfigFiles.CFProperties);
			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(2);
			const writeTemplatesArgs = td.explain(utilsStubs.writeTemplates).calls.map((call) => call.args[0]);
			expect(writeTemplatesArgs).to.include(flowModule.ConfigFiles.DAEnvVars);
			expect(writeTemplatesArgs).to.include(flowModule.ConfigFiles.TAEnvVars);
			expect(td.explain(fsStubs.unlinkSync).calls.some((call) => call.args[0] === flowModule.ConfigFiles.FargateDeployYAML)).to.equal(true);
		});

		it('writes only CF properties for ECS deployment and removes EC2 YAML', async () => {
			td.when(fsStubs.existsSync(td.matchers.anything())).thenReturn(true);
			td.when(helpersStubs.unzip(td.matchers.anything())).thenResolve();

			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: true });
			installConfig.gatewayConfig = buildGatewayConfig(helpersStubs, flowModule.DeploymentTypes.ECS_FARGATE);

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeToFile).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(0);
			expect(td.explain(fsStubs.unlinkSync).calls.some((call) => call.args[0] === flowModule.ConfigFiles.EC2DeployYAML)).to.equal(true);
		});

		it('writes CF + DA/TA templates and removes EC2/Fargate YAML for OTHER deployment', async () => {
			td.when(fsStubs.existsSync(td.matchers.anything())).thenReturn(true);
			td.when(helpersStubs.unzip(td.matchers.anything())).thenResolve();

			const installConfig = buildInstallConfig({ isDaEnabled: true, isTaEnabled: true });
			installConfig.gatewayConfig = buildGatewayConfig(helpersStubs, flowModule.DeploymentTypes.OTHER, 'eu-west-1');

			await flowModule.completeInstall(installConfig);

			expect(td.explain(utilsStubs.writeToFile).callCount).to.equal(1);
			expect(td.explain(utilsStubs.writeTemplates).callCount).to.equal(2);
			expect(td.explain(fsStubs.unlinkSync).calls.some((call) => call.args[0] === flowModule.ConfigFiles.EC2DeployYAML)).to.equal(true);
			expect(td.explain(fsStubs.unlinkSync).calls.some((call) => call.args[0] === flowModule.ConfigFiles.FargateDeployYAML)).to.equal(true);
		});
	});
});

function createHelpersStubs() {
	class AWSAgentValues {
		constructor(deploymentType) {
			this.apigwAgentConfigZipFile = '';
			this.centralConfig = {};
			this.traceabilityConfig = {};
			this.fullTransactionLogging = false;
			this.logGroup = '';
			this.region = 'us-east-1';
			this.stageTagName = '';
			this.agentCoreGatewayMode = false;
			this.agentCore = { logGroupPrefix: '', iamAuthEnabled: false, cloudTrailEnabled: false, cloudTrailBucket: '' };
			this.cognitoUserPoolIDs = [];
			this.cloudFormationConfig = {
				APIGWCWRoleSetup: '',
				APIGWTrafficLogGroupName: '/aws/apigw/logs',
				AgentResourcesBucket: '',
				DeploymentType: deploymentType,
				DiscoveryAgentLogGroupName: '/aws/da/logs',
				DiscoveryAgentVersion: '',
				EC2InstanceType: '',
				EC2KeyName: '',
				EC2PublicIPAddress: '',
				EC2SSHLocation: '0.0.0.0/0',
				EC2VPCID: '',
				ECSClusterName: '',
				SSMPrivateKeyParameter: '/ssm/private',
				SSMPublicKeyParameter: '/ssm/public',
				SecurityGroup: '',
				Subnet: '',
				TraceabilityAgentLogGroupName: '/aws/ta/logs',
				TraceabilityAgentVersion: '',
			};
		}

		updateCloudFormationConfig() {
			return;
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
			AWS_REGEXP: /.*/,
			AWS_REGEXP_LOG_GROUP_NAME: /.*/,
			AWS_REGEXP_SECURITY_GROUP: /.*/,
			AWS_REGEXP_SSH_LOCATION: /.*/,
			AWS_REGEXP_SUBNET: /.*/,
			AWS_REGEXP_VPC_ID: /.*/,
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
		invalidValueExampleErrMsg: () => 'invalid',
		pwd: '/tmp',
		pwdWin: 'C:\\\\tmp',
		streamPipeline: td.func('streamPipeline'),
		unzip: td.func('unzip'),
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
		traceabilityConfig: {},
		gatewayConfig: {},
	};
}

function buildGatewayConfig(helpersStubs, deploymentType, region = 'us-east-1') {
	const gatewayConfig = new helpersStubs.AWSAgentValues(deploymentType);
	gatewayConfig.region = region;
	gatewayConfig.apigwAgentConfigZipFile = 'aws_apigw_agent_config-latest.zip';
	gatewayConfig.cloudFormationConfig.AgentResourcesBucket = 'agents-bucket';
	gatewayConfig.cloudFormationConfig.EC2KeyName = 'my-key';
	gatewayConfig.cloudFormationConfig.ECSClusterName = 'ecs-cluster';
	gatewayConfig.cloudFormationConfig.SecurityGroup = 'sg-1234567890abcdef';
	gatewayConfig.cloudFormationConfig.Subnet = 'subnet-1234567890abcdef';
	gatewayConfig.cloudFormationConfig.SSMPrivateKeyParameter = '/ssm/private';
	gatewayConfig.cloudFormationConfig.SSMPublicKeyParameter = '/ssm/public';
	return gatewayConfig;
}
