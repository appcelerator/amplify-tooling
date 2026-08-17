import Command from '../../lib/command.js';
import { highlight } from '../../lib/logger.js';

export default class EngageCompletion extends Command {
	static override summary = 'Set autocompletion for Axway CLI commands.';

	static override aliases = [ 'central:completion' ];

	static override description = `Autocompletion is provided by the Axway CLI autocomplete command.
Run ${highlight('"axway autocomplete"')} to install and set up autocompletion.`;

	async run(): Promise<any> {
		this.log('Autocompletion is managed by the Axway CLI autocomplete command.\n');
		this.log('To set up autocompletion, run:\n');
		this.log(`  ${highlight('axway autocomplete')}\n`);
		this.log('Follow the instructions to setup autocompletion.');
	}
}
