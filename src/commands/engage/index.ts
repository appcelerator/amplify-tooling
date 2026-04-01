import Command from '../../lib/command.js';
import { highlight } from '../../lib/logger.js';

export default class EngageCommand extends Command {
	static override hidden = true;

	static override aliases = [ 'central' ];

	static override summary = 'Manage APIs, services and publish to the Amplify Marketplace.';

	static override description = `You must be authenticated to manage Engage Operations.
Run ${highlight('"<%= config.bin %> auth login"')} to authenticate.`;

	static override examples = [
		{
			command: '<%= config.bin %> <%= command.id %> apply',
			description: 'Update resources from a file'
		},
		{
			command: '<%= config.bin %> <%= command.id %> completion',
			description: 'Output shell completion code'
		},
		{
			command: '<%= config.bin %> <%= command.id %> config',
			description: 'Configure Engage CLI settings'
		},
		{
			command: '<%= config.bin %> <%= command.id %> create',
			description: 'Create one or more resources from a file or stdin'
		},
		{
			command: '<%= config.bin %> <%= command.id %> delete',
			description: 'Delete resources'
		},
		{
			command: '<%= config.bin %> <%= command.id %> edit',
			description: 'Edit and update resources by using the default editor'
		},
		{
			command: '<%= config.bin %> <%= command.id %> get',
			description: 'List one or more resources'
		},
		{
			command: '<%= config.bin %> <%= command.id %> install',
			description: 'Install additional platform resources'
		},
		{
			command: '<%= config.bin %> <%= command.id %> productize',
			description: 'Productize one or more API Services from a file'
		}
	];

	static override authenticated = false;

	async run() {
		return this.help();
	}
}
