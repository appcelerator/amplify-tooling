import { expect } from 'chai';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = pathToFileURL(path.resolve(__dirname, '../../../../../../dist')).href;
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const AGENTS_INDEX = `${distRoot}/lib/engage/utils/agents/index.js`;
const SAAS_BASE_MODULE = `${distRoot}/lib/engage/utils/agents/flows/saasAgentsBase.js`;
const FLOW_MODULE = `${distRoot}/lib/engage/utils/agents/flows/awsSaasAgents.js`;
const TYPES_MODULE = `${distRoot}/lib/engage/types.js`;

describe('AWS SaaS agent flow', () => {
	let flowModule;
	let engageTypes;
	let promptStubs;
	let helpersStubs;
	let saasBaseStubs;

	beforeEach(async () => {
		const realPrompts = await import(BASIC_PROMPTS);
		const realHelpers = await import(AGENTS_INDEX);

		promptStubs = {
			...realPrompts,
			askInput: td.func('askInput'),
			askList: td.func('askList'),
			validateRegex: td.func('validateRegex'),
			validateInputLength: td.func('validateInputLength'),
		};
		td.when(promptStubs.validateRegex(td.matchers.anything(), td.matchers.anything())).thenReturn(() => true);
		td.when(promptStubs.validateInputLength(td.matchers.anything(), td.matchers.anything())).thenReturn(() => true);
		await td.replaceEsm(BASIC_PROMPTS, promptStubs);

		helpersStubs = {
			...realHelpers,
			askAWSRegion: td.func('askAWSRegion'),
		};
		await td.replaceEsm(AGENTS_INDEX, helpersStubs);
		td.when(helpersStubs.askAWSRegion()).thenResolve('us-east-1');

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
		td.when(saasBaseStubs.createDataplaneResources(td.matchers.anything(), td.matchers.anything())).thenResolve({ name: 'dp-aws' });
		td.when(saasBaseStubs.createAgentResources(td.matchers.anything(), td.matchers.anything(), td.matchers.anything())).thenResolve();

		engageTypes = await import(TYPES_MODULE);
		flowModule = await import(FLOW_MODULE);
	});

	afterEach(() => td.reset());

	it('collects assume-role auth and TA options', async () => {
		const askInputResponses = [
			'arn:aws:iam::000000000000:role/name-of-role',
			'external-id',
			'stage-tag',
			'arn:aws:logs:us-east-1:000000000000:log-group:my-group',
		];
		td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());
		const askListResponses = [ 'Assume Role Policy', engageTypes.YesNo.Yes ];
		td.when(promptStubs.askList(td.matchers.anything())).thenDo(() => askListResponses.shift());

		const result = await flowModule.AWSSaaSInstallMethods.AskGatewayQuestions(buildInstallConfig(engageTypes.GatewayTypes.AWS_GATEWAY, true));
		expect(result.authType).to.equal('Assume Role Policy');
		expect(result.assumeRole).to.contain('arn:aws:iam');
		expect(result.fullTransactionLogging).to.equal(true);
	});

	it('collects TA redaction inputs', async () => {
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
			'arn:aws:iam::000000000000:role/name-of-role',
			'external-id',
			'stage-tag',
			'arn:aws:logs:us-east-1:000000000000:log-group:my-group',
			'30m',
			'tag=prod',
			'1h',
			'/users/.*',
			'token',
			'authorization',
			'.+',
			'x-api-key',
			'set-cookie',
			'***',
		];
		td.when(promptStubs.askInput(td.matchers.anything())).thenDo(() => askInputResponses.shift());

		const askListResponses = [
			'Assume Role Policy',
			engageTypes.YesNo.Yes,
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

		const result = await flowModule.AWSSaaSInstallMethods.AskGatewayQuestions(buildInstallConfig(engageTypes.GatewayTypes.AWS_GATEWAY, true));
		expect(result.redaction.path).to.deep.equal([ '/users/.*' ]);
		expect(result.redaction.queryArgument.show).to.deep.equal([ 'token' ]);
		expect(result.redaction.queryArgument.sanitize).to.have.length(1);
		expect(result.redaction.requestHeaders.show).to.deep.equal([ 'x-api-key' ]);
		expect(result.redaction.responseHeaders.show).to.deep.equal([ 'set-cookie' ]);
		expect(result.redaction.maskingCharacter).to.equal('***');
	});

	it('builds AWS dataplane config when TA enabled', async () => {
		const installConfig = buildInstallConfig(engageTypes.GatewayTypes.AWS_GATEWAY, true);
		installConfig.gatewayConfig = {
			accessLogARN: 'arn:aws:logs:us-east-1:000000000000:log-group:my-group',
			fullTransactionLogging: true,
			stageTagName: 'stage-tag',
			redaction: {},
		};

		await flowModule.AWSSaaSInstallMethods.FinalizeGatewayInstall(installConfig, {}, {});
		const dataplaneArg = td.explain(saasBaseStubs.createDataplaneResources).calls[0].args[1];
		expect(dataplaneArg.type).to.equal('AWS');
		expect(dataplaneArg.accessLogARN).to.contain('arn:aws:logs');
	});

	it('passes IDP config in completeInstall context', async () => {
		const installConfig = buildInstallConfig(engageTypes.GatewayTypes.AWS_GATEWAY, true);
		installConfig.idpConfig = [ [ { name: 'idp-1' } ], [ { authType: 'access_token' } ] ];
		installConfig.gatewayConfig = {
			accessLogARN: 'arn:aws:logs:us-east-1:000000000000:log-group:my-group',
			fullTransactionLogging: false,
			stageTagName: 'stage-tag',
			redaction: {},
		};

		await flowModule.AWSSaaSInstallMethods.FinalizeGatewayInstall(installConfig, {}, {});
		const ctx = td.explain(saasBaseStubs.createIDPResources).calls[0].args[0];
		expect(ctx.installConfig.idpConfig).to.deep.equal(installConfig.idpConfig);
		expect(ctx.agentValues).to.equal(installConfig.gatewayConfig);
	});

	it('stops finalize when IDP resource creation fails', async () => {
		td.when(saasBaseStubs.createIDPResources(td.matchers.anything())).thenResolve(false);

		const installConfig = buildInstallConfig(engageTypes.GatewayTypes.AWS_GATEWAY, true);
		installConfig.gatewayConfig = {
			accessLogARN: 'arn:aws:logs:us-east-1:000000000000:log-group:my-group',
			fullTransactionLogging: false,
			stageTagName: 'stage-tag',
			redaction: {},
		};

		await flowModule.AWSSaaSInstallMethods.FinalizeGatewayInstall(installConfig, {}, {});
		expect(td.explain(saasBaseStubs.setupEnvironment).callCount).to.equal(0);
		expect(td.explain(saasBaseStubs.createDataplaneResources).callCount).to.equal(0);
		expect(td.explain(saasBaseStubs.createAgentResources).callCount).to.equal(0);
	});

	it('stops finalize when dataplane resource creation fails', async () => {
		td.when(saasBaseStubs.createDataplaneResources(td.matchers.anything(), td.matchers.anything())).thenResolve(null);

		const installConfig = buildInstallConfig(engageTypes.GatewayTypes.AWS_GATEWAY, true);
		installConfig.gatewayConfig = {
			accessLogARN: 'arn:aws:logs:us-east-1:000000000000:log-group:my-group',
			fullTransactionLogging: false,
			stageTagName: 'stage-tag',
			redaction: {},
		};

		await flowModule.AWSSaaSInstallMethods.FinalizeGatewayInstall(installConfig, {}, {});
		expect(td.explain(saasBaseStubs.setupEnvironment).callCount).to.equal(1);
		expect(td.explain(saasBaseStubs.createAgentResources).callCount).to.equal(0);
	});
});

function buildInstallConfig(gatewayType, isTaEnabled) {
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
			ampcEnvInfo: { name: 'installed-env', isNew: false },
			ampcDosaInfo: { isNew: false },
			ampcTeamName: 'team-a',
			dosaAccount: { publicKey: 'pub.pem', privateKey: 'priv.pem' },
		},
		deploymentType: 'Hosted',
		traceabilityConfig: {},
		gatewayConfig: {},
	};
}
