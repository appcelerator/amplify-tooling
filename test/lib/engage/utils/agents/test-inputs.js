import { expect } from 'chai';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as td from 'testdouble';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distRoot = pathToFileURL(path.resolve(__dirname, '../../../../../dist')).href;
const BASIC_PROMPTS = `${distRoot}/lib/engage/utils/basic-prompts.js`;
const INPUTS_MODULE = `${distRoot}/lib/engage/utils/agents/inputs.js`;

describe('Apigee X agent inputs', () => {
	let inputs;
	let promptStubs;

	beforeEach(async () => {
		const realPrompts = await import(BASIC_PROMPTS);
		promptStubs = {
			...realPrompts,
			askInput: td.func('askInput'),
			askList: td.func('askList'),
		};
		await td.replaceEsm(BASIC_PROMPTS, promptStubs);

		inputs = await import(INPUTS_MODULE);
	});

	afterEach(() => td.reset());

	describe('askApigeeXMode', () => {
		it('offers the proxy and Gemini Enterprise Agent Platform modes, proxy by default', async () => {
			td.when(promptStubs.askList(td.matchers.anything())).thenResolve('gemini-agent-platform');

			const mode = await inputs.askApigeeXMode();

			expect(mode).to.equal('gemini-agent-platform');
			const listConfig = td.explain(promptStubs.askList).calls[0].args[0];
			expect(listConfig.default).to.equal('proxy');
			expect(listConfig.choices.map((choice) => choice.value)).to.deep.equal([ 'proxy', 'gemini-agent-platform' ]);
		});
	});

	describe('askGeminiAgentPlatformConfig', () => {
		it('splits the lists and asks for gateways when every runtime is kept', async () => {
			const askInputResponses = [
				' us-central1 , europe-west1 ,',
				'gw-1, projects/p/locations/us-central1/agentGateways/gw-2',
			];
			td.when(promptStubs.askInput(td.matchers.anything()))
				.thenDo(() => askInputResponses.shift());
			const askListResponses = [ 'ALL', 'Yes' ];
			td.when(promptStubs.askList(td.matchers.anything()))
				.thenDo(() => askListResponses.shift());

			const config = await inputs.askGeminiAgentPlatformConfig();

			expect(config.locations).to.deep.equal([ 'us-central1', 'europe-west1' ]);
			expect(config.runtimes).to.deep.equal([ ]);
			expect(config.gateways).to.deep.equal([ 'gw-1', 'projects/p/locations/us-central1/agentGateways/gw-2' ]);
			expect(config.mcpDiscoveryEnabled).to.equal(true);
			expect(td.explain(promptStubs.askInput).calls[0].args[0].validate).to.equal(inputs.validateGCPLocations);
		});

		it('skips the gateways when only Agent Registry agents are kept', async () => {
			td.when(promptStubs.askInput(td.matchers.anything())).thenResolve('');
			const askListResponses = [ 'agent-registry', 'No' ];
			td.when(promptStubs.askList(td.matchers.anything()))
				.thenDo(() => askListResponses.shift());

			const config = await inputs.askGeminiAgentPlatformConfig();

			expect(config.locations).to.deep.equal([ ]);
			expect(config.runtimes).to.deep.equal([ 'agent-registry' ]);
			expect(config.gateways).to.deep.equal([ ]);
			expect(config.mcpDiscoveryEnabled).to.equal(false);
			// the locations are the only input asked
			expect(td.explain(promptStubs.askInput).callCount).to.equal(1);
		});
	});

	describe('validateGCPLocations', () => {
		it('accepts a comma-separated list of locations', () => {
			expect(inputs.validateGCPLocations('us-central1, europe-west1')).to.equal(true);
		});

		it('names every entry that is not a location', () => {
			expect(inputs.validateGCPLocations('us-central1, Europe_West1, 1abc'))
				.to.equal('Invalid location(s) entered: Europe_West1, 1abc. A location must be in the form of us-central1');
		});
	});
});
