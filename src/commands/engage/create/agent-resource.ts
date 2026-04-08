import Command from '../../../lib/command.js';
import Renderer from '../../../lib/engage/results/renderer.js';
import { createAgentResource } from '../../../lib/engage/services/create-service.js';
import logger, { highlight } from '../../../lib/logger.js';

export class EngageCreateAgentResourceCommand extends Command {
	static override summary = 'Create an agent resource.';
	static override aliases = [ 'central:create:agent-resource', 'central:create:agentresource', 'engage:create:agentresource' ];

	static override description = `You must be authenticated to list one or more resources.
        Run ${highlight('"axway auth login"')} to authenticate.`;

	async run(): Promise<void> {
		const log = logger('engage:create:agent-resource');
		const { flags, account } = await this.parse(EngageCreateAgentResourceCommand);
		const renderer = new Renderer(console, flags.output);
		let isCmdError = false;
		try {
			await createAgentResource({ account, useCache: flags.useCache });
		} catch (e: any) {
			log('command error', e);
			renderer.anyError(e);
			isCmdError = true;
		} finally {
			log('command finished');
			if (isCmdError) {
				process.exit(1);
			}
		}
	}
}
