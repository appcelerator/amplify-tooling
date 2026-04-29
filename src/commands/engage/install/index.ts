import Command from '../../../lib/command.js';
import { commonFlags } from '../../../lib/engage/flags.js';
import Renderer from '../../../lib/engage/results/renderer.js';
import { highlight } from '../../../lib/logger.js';

export class EngageInstall extends Command {
	static override summary = 'Install additional platform resources.';

	static override aliases = [ 'central:install' ];

	static override description = `You must be authenticated to install additional platform resources.
    Run ${highlight('"axway auth login"')} to authenticate.`;

	static override examples = [
		{
			description: 'Productize an API Service from a file',
			command: '<%= config.bin %> <%= command.id %> <Resource> --file <FilePath>',
		},
	];

	static override flags = {
		...commonFlags,
	};

	async run(): Promise<void> {
		const renderer = new Renderer(console);
		renderer.error('Error: You must specify the type of the resource to install.');
		console.log(`\nUSAGE:
To install agents in interactive mode:\t"axway engage install agents"
`);
		process.exit(1);
	}
}
