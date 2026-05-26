import { expect } from 'chai';
import path from 'path';
import { fileURLToPath } from 'url';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = path.resolve(__dirname, '../../../../../../dist');
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/azureSaasAgents.js`;
const SAAS_BASE_MODULE = `${distRoot}/lib/engage/utils/agents/flows/saasAgentsBase.js`;
const TYPES_MODULE = `${distRoot}/lib/engage/types.js`;

describe('Azure SaaS agent flow (Gateway + EventHub)', () => {
	let flowModule;
	let engageTypes;
	let promptStubs;
	let saasBaseStubs;

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

		const realSaasBase = await import(SAAS_BASE_MODULE);

		saasBaseStubs = {
			...realSaasBase,
			askFrequencyAndFilter: td.func('askFrequencyAndFilter'),
			createIDPResources: td.func('createIDPResources'),
			setupEnvironment: td.func('setupEnvironment'),
			createDataplaneResources: td.func('createDataplaneResources'),
			createAgentResources: td.func('createAgentResources'),
		};
		await td.replaceEsm(SAAS_BASE_MODULE, saasBaseStubs);

		td.when(saasBaseStubs.askFrequencyAndFilter(td.matchers.anything(), td.matchers.anything())).thenDo((values) => values);
		td.when(saasBaseStubs.createIDPResources(td.matchers.anything())).thenResolve(true);
		td.when(saasBaseStubs.setupEnvironment(td.matchers.anything())).thenResolve();
		td.when(saasBaseStubs.createDataplaneResources(td.matchers.anything(), td.matchers.anything())).thenResolve({ name: 'dp-azure' });
		td.when(saasBaseStubs.createAgentResources(td.matchers.anything(), td.matchers.anything(), td.matchers.anything())).thenResolve();

		engageTypes = await import(TYPES_MODULE);
		flowModule = await import(FLOW_MODULE);
	});

	afterEach(() => td.reset());

	describe('AzureSaaSInstallMethods metadata', () => {
		it('exports install methods with required hooks', () => {
			const methods = flowModule.AzureSaaSInstallMethods;
			expect(methods).to.exist;
			expect(methods.GetBundleType).to.be.a('function');
			expect(methods.GetDeploymentType).to.be.a('function');
			expect(methods.AskGatewayQuestions).to.be.a('function');
			expect(methods.FinalizeGatewayInstall).to.be.a('function');
			expect(methods.ConfigFiles).to.be.an('array');
			expect(methods.GatewayDisplay).to.be.a('string').and.not.empty;
		});

		it('returns hosted config type and bundle branch by gateway', async () => {
			td.when(promptStubs.askList(td.matchers.anything())).thenResolve('All Agents');
			const gwBundle = await flowModule.askBundleType(engageTypes.GatewayTypes.AZURE_GATEWAY);
			const ehBundle = await flowModule.askBundleType(engageTypes.GatewayTypes.AZURE_EVENTHUB);
			const configType = await flowModule.AzureSaaSInstallMethods.GetDeploymentType();

			expect(gwBundle).to.equal('All Agents');
			expect(ehBundle).to.equal(engageTypes.BundleType.DISCOVERY);
			expect(configType).to.equal(engageTypes.AgentConfigTypes.HOSTED);
		});
	});

	describe('AskGatewayQuestions', () => {
		it('collects gateway mode prompts with TA EventHub details', async () => {
			const askInputResponses = [
				'tenant-id',
				'subscription-id',
				'client-id',
				'client-secret',
				'resource-group',
				'apim-service',
				'RootManageSharedAccessKey',
				'shared-key',
				'event-hub-name',
				'event-hub-namespace',
				'$Default',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ gatewayType: engageTypes.GatewayTypes.AZURE_GATEWAY, isTaEnabled: true }));
			expect(result.apimManagementServiceName).to.equal('apim-service');
			expect(result.eventHubName).to.equal('event-hub-name');
			expect(result.eventHubConsumerGroup).to.equal('$Default');
		});

		it('collects eventhub mode prompts without TA and asks only namespace', async () => {
			const askInputResponses = [
				'tenant-id',
				'subscription-id',
				'client-id',
				'client-secret',
				'resource-group',
				'event-hub-namespace',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ gatewayType: engageTypes.GatewayTypes.AZURE_EVENTHUB, isTaEnabled: false }));
			expect(result.apimManagementServiceName).to.equal('');
			expect(result.eventHubNamespace).to.equal('event-hub-namespace');
			expect(result.eventHubName).to.equal('');
		});

		it('collects TA redaction inputs for gateway mode', async () => {
			td.when(saasBaseStubs.askFrequencyAndFilter(td.matchers.anything(), td.matchers.anything()))
				.thenDo(async (values) => {
					values.frequencyDA = await promptStubs.askInput({ msg: 'DA_FREQUENCY' });
					values.queueDA = (await promptStubs.askList({ msg: 'QUEUE' })) === engageTypes.YesNo.Yes;
					values.filterDA = await promptStubs.askInput({ msg: 'DA_FILTER' });
					values.frequencyTA = await promptStubs.askInput({ msg: 'TA_FREQUENCY' });

					values.redaction.path.push(await promptStubs.askInput({ msg: 'REDACT_SHOW_PATH' }));
					await promptStubs.askList({ msg: 'ENTER_MORE_PATH' });

					values.redaction.queryArgument.show.push(await promptStubs.askInput({ msg: 'REDACT_SHOW_QA' }));
					await promptStubs.askList({ msg: 'ENTER_MORE_QA' });
					if ((await promptStubs.askList({ msg: 'ENTER_SANITIZE_QA' })) === engageTypes.YesNo.Yes) {
						values.redaction.queryArgument.sanitize.push({
							keyMatch: await promptStubs.askInput({ msg: 'SANITIZE_KEY_QA' }),
							valueMatch: await promptStubs.askInput({ msg: 'SANITIZE_VAL_QA' }),
						});
						await promptStubs.askList({ msg: 'ENTER_MORE_SANITIZE_QA' });
					}

					values.redaction.requestHeaders.show.push(await promptStubs.askInput({ msg: 'REDACT_SHOW_REQ' }));
					await promptStubs.askList({ msg: 'ENTER_MORE_REQ' });
					await promptStubs.askList({ msg: 'ENTER_SANITIZE_REQ' });

					values.redaction.responseHeaders.show.push(await promptStubs.askInput({ msg: 'REDACT_SHOW_RES' }));
					await promptStubs.askList({ msg: 'ENTER_MORE_RES' });
					await promptStubs.askList({ msg: 'ENTER_SANITIZE_RES' });

					values.redaction.maskingCharacter = await promptStubs.askInput({ msg: 'MASKING_CHARS' });
					return values;
				});

			const askInputResponses = [
				'tenant-id',
				'subscription-id',
				'client-id',
				'client-secret',
				'resource-group',
				'apim-service',
				'RootManageSharedAccessKey',
				'shared-key',
				'event-hub-name',
				'event-hub-namespace',
				'$Default',
				'30m',
				'tag=finance',
				'1h',
				'/orders/.*',
				'customerId',
				'x-customer-id',
				'.+',
				'authorization',
				'set-cookie',
				'***',
			];
			td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

			const askListResponses = [
				engageTypes.YesNo.No,
				engageTypes.YesNo.No,
				engageTypes.YesNo.No,
				engageTypes.YesNo.Yes,
				engageTypes.YesNo.No,
				engageTypes.YesNo.No,
				engageTypes.YesNo.No,
				engageTypes.YesNo.No,
				engageTypes.YesNo.No,
			];
			td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

			const result = await flowModule.gatewayConnectivity(buildInstallConfig({ gatewayType: engageTypes.GatewayTypes.AZURE_GATEWAY, isTaEnabled: true }));
			expect(result.redaction.path).to.deep.equal([ '/orders/.*' ]);
			expect(result.redaction.queryArgument.show).to.deep.equal([ 'customerId' ]);
			expect(result.redaction.queryArgument.sanitize).to.have.length(1);
			expect(result.redaction.requestHeaders.show).to.deep.equal([ 'authorization' ]);
			expect(result.redaction.responseHeaders.show).to.deep.equal([ 'set-cookie' ]);
			expect(result.redaction.maskingCharacter).to.equal('***');
		});
	});

	describe('FinalizeGatewayInstall', () => {
		it('uses APIM mode dataplane config for AZURE_GATEWAY', async () => {
			const installConfig = buildInstallConfig({ gatewayType: engageTypes.GatewayTypes.AZURE_GATEWAY, isTaEnabled: true });
			installConfig.gatewayConfig = {
				tenantId: 'tenant-id',
				resourceGroup: 'resource-group',
				subscriptionId: 'subscription-id',
				apimManagementServiceName: 'apim-service',
				eventHubName: 'event-hub-name',
				eventHubNamespace: 'event-hub-namespace',
				eventHubConsumerGroup: '$Default',
				sampling: {},
				redaction: {},
			};

			await flowModule.completeInstall(installConfig, {}, {});
			expect(td.explain(saasBaseStubs.createDataplaneResources).callCount).to.equal(1);
			const dataplaneArg = td.explain(saasBaseStubs.createDataplaneResources).calls[0].args[1];
			expect(dataplaneArg.mode).to.equal(engageTypes.AzureDataplaneMode.APIM);
		});

		it('uses EventHub mode dataplane config for AZURE_EVENTHUB', async () => {
			const installConfig = buildInstallConfig({ gatewayType: engageTypes.GatewayTypes.AZURE_EVENTHUB, isTaEnabled: false });
			installConfig.gatewayConfig = {
				tenantId: 'tenant-id',
				resourceGroup: 'resource-group',
				subscriptionId: 'subscription-id',
				eventHubNamespace: 'event-hub-namespace',
				sampling: {},
				redaction: {},
			};

			await flowModule.completeInstall(installConfig, {}, {});
			const dataplaneArg = td.explain(saasBaseStubs.createDataplaneResources).calls[0].args[1];
			expect(dataplaneArg.mode).to.equal(engageTypes.AzureDataplaneMode.EventHub);
		});

		it('passes IDP config in completeInstall context', async () => {
			const installConfig = buildInstallConfig({ gatewayType: engageTypes.GatewayTypes.AZURE_GATEWAY, isTaEnabled: true });
			installConfig.idpConfig = [ [ { name: 'idp-1' } ], [ { authType: 'access_token' } ] ];
			installConfig.gatewayConfig = {
				tenantId: 'tenant-id',
				resourceGroup: 'resource-group',
				subscriptionId: 'subscription-id',
				apimManagementServiceName: 'apim-service',
				eventHubName: 'event-hub-name',
				eventHubNamespace: 'event-hub-namespace',
				eventHubConsumerGroup: '$Default',
				sampling: {},
				redaction: {},
			};

			await flowModule.completeInstall(installConfig, {}, {});
			const ctx = td.explain(saasBaseStubs.createIDPResources).calls[0].args[0];
			expect(ctx.installConfig.idpConfig).to.deep.equal(installConfig.idpConfig);
			expect(ctx.agentValues).to.equal(installConfig.gatewayConfig);
		});

		it('stops finalize when IDP resource creation fails', async () => {
			td.when(saasBaseStubs.createIDPResources(td.matchers.anything())).thenResolve(false);

			const installConfig = buildInstallConfig({ gatewayType: engageTypes.GatewayTypes.AZURE_GATEWAY, isTaEnabled: true });
			installConfig.gatewayConfig = {
				tenantId: 'tenant-id',
				resourceGroup: 'resource-group',
				subscriptionId: 'subscription-id',
				apimManagementServiceName: 'apim-service',
				eventHubName: 'event-hub-name',
				eventHubNamespace: 'event-hub-namespace',
				eventHubConsumerGroup: '$Default',
				sampling: {},
				redaction: {},
			};

			await flowModule.completeInstall(installConfig, {}, {});
			expect(td.explain(saasBaseStubs.setupEnvironment).callCount).to.equal(0);
			expect(td.explain(saasBaseStubs.createDataplaneResources).callCount).to.equal(0);
			expect(td.explain(saasBaseStubs.createAgentResources).callCount).to.equal(0);
		});

		it('stops finalize when dataplane resource creation fails', async () => {
			td.when(saasBaseStubs.createDataplaneResources(td.matchers.anything(), td.matchers.anything())).thenResolve(null);

			const installConfig = buildInstallConfig({ gatewayType: engageTypes.GatewayTypes.AZURE_GATEWAY, isTaEnabled: true });
			installConfig.gatewayConfig = {
				tenantId: 'tenant-id',
				resourceGroup: 'resource-group',
				subscriptionId: 'subscription-id',
				apimManagementServiceName: 'apim-service',
				eventHubName: 'event-hub-name',
				eventHubNamespace: 'event-hub-namespace',
				eventHubConsumerGroup: '$Default',
				sampling: {},
				redaction: {},
			};

			await flowModule.completeInstall(installConfig, {}, {});
			expect(td.explain(saasBaseStubs.setupEnvironment).callCount).to.equal(1);
			expect(td.explain(saasBaseStubs.createAgentResources).callCount).to.equal(0);
		});
	});
});

function buildInstallConfig({ gatewayType, isTaEnabled = true } = {}) {
	return {
		log: () => {},
		gatewayType,
		switches: {
			isDockerInstall: false,
			isHelmInstall: false,
			isHostedInstall: true,
			isDaEnabled: true,
			isTaEnabled,
		},
		centralConfig: {
			apiServerClient: {},
			definitionManager: {},
			ampcEnvInfo: { name: 'installed-env' },
			ampcDosaInfo: { isNew: false },
			dosaAccount: { publicKey: 'pub.pem', privateKey: 'priv.pem' },
		},
		deploymentType: 'Hosted',
		traceabilityConfig: {},
		gatewayConfig: {},
	};
}
