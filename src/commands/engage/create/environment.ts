import { Args } from '@oclif/core';
import Command from '../../../lib/command.js';
import logger, { highlight } from '../../../lib/logger.js';
import Renderer from '../../../lib/engage/results/renderer.js';
import { createEnvironment } from '../../../lib/engage/services/create-service.js';
import { renderResponse } from '../../../lib/engage/results/resultsrenderer.js';

export class EngageCreateEnvironmentCommand extends Command {

	static override summary = 'Create an environment with the specified name.';

	static override aliases = [ 'central:create:environment', 'central:create:env', 'engage:create:env' ];

	static override description = `You must be authenticated to list one or more resources.
        Run ${highlight('"axway auth login"')} to authenticate.`;

	static override args = {
		name: Args.string({
			description: 'Name of new environment.',
			required: true
		})
	};

	async run(): Promise<void> {
		const log = logger('engage:create:environment');
		const { args, flags, account } = await this.parse(EngageCreateEnvironmentCommand);
		const renderer = new Renderer(console, flags.output);
		let commandIsSuccessful = true;
		try {
			const createMessage = 'Creating an environment';
			renderer.startSpin(createMessage);
			const result = await createEnvironment({ account, name: args.name, useCache: flags.useCache });
			if (flags.output) {
				renderResponse(console, result, flags.output);
			}
			if (result.error) {
				renderer.errors(result.error);
				commandIsSuccessful = false;
			}
		} catch (e: any) {
			log('command error', e);
			renderer.anyError(e);
			commandIsSuccessful = false;
		} finally {
			log('command complete');
			renderer.stopSpin();
			if (!commandIsSuccessful) {
				process.exit(1);
			}
		}
	}
}
