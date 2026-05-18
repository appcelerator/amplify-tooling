import { Args } from '@oclif/core';
import Command from '../../../lib/command.js';
import logger, { highlight } from '../../../lib/logger.js';
import Renderer from '../../../lib/engage/results/renderer.js';
import { editEnvironment } from '../../../lib/engage/services/edit-service.js';

export default class EngageEditEnvironmentCommand extends Command {
	static override summary = 'Edit an environment with the specified name.';

	static override aliases = [ 'central:edit:environment', 'central:edit:env', 'engage:edit:env' ];

	static override description = `You must be authenticated to edit one or more resources.
        Run ${highlight('"axway auth login"')} to authenticate.`;

	static override args = {
		name: Args.string({
			description: 'Name of the environment.',
			required: true
		})
	};

	async run(): Promise<any> {
		const log = logger('engage:edit:environment');
		let renderer = new Renderer((text: string) => this.log(text), undefined);
		try {
			const { args, flags, account } = await this.parse(EngageEditEnvironmentCommand);
			renderer = new Renderer((text: string) => this.log(text), flags.output);
			await editEnvironment({ account, name: args.name, useCache: flags.useCache, render: renderer, outputFormat: flags.output, log: (text: string) => this.log(text) });
		} catch (e: any) {
			log.error('command error', e);
			renderer.anyError(e);
			process.exit(1);
		}
	}
}
