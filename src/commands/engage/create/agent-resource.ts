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
		let renderer = new Renderer((text: string) => this.log(text), undefined);
		let isCmdError = false;
		try {
			const { flags, account } = await this.parse(EngageCreateAgentResourceCommand);
			renderer = new Renderer((text: string) => this.log(text), flags.output);
			await createAgentResource({ account, useCache: flags.useCache, log: (text: string) => this.log(text) });
		} catch (e: any) {
			log.error('command error', e);
			renderer.anyError(e);
			isCmdError = true;
		} finally {
			log.log('command finished');
			if (isCmdError) {
				process.exit(1);
			}
		}
	}
}
