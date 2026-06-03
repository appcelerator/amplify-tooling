import Command from '../../lib/command.js';
import { highlight } from '../../lib/logger.js';

export default class TeamCommand extends Command {
	static override hidden = true;

	static override summary = 'Manage Amplify Platform organization teams.';

	static override description = `You must be authenticated to view or manage organization teams.
Run ${highlight(`"<%= config.bin %> auth login"`) } to authenticate.

You may specify the team by name or guid.

For team user commands, you may refer to a user by email address or guid, or a service account by guid or client id.`;

	static overrideexamples = [
		{
			description: 'List all organization teams',
			command: '<%= config.bin %> <%= command.id %> list',
		},
		{
			description: 'View team details',
			command: '<%= config.bin %> <%= command.id %> view <team>',
		},
		{
			description: 'Create a new team in an organization',
			command: '<%= config.bin %> <%= command.id %> create <team name>',
		},
		{
			description: 'Update team information',
			command: '<%= config.bin %> <%= command.id %> update <team> [options]',
		},
		{
			description: 'Remove a team',
			command: '<%= config.bin %> <%= command.id %> remove <team>',
		},
		{
			description: 'List all users in a team',
			command: '<%= config.bin %> <%= command.id %> user list',
		},
		{
			description: 'View available user roles',
			command: '<%= config.bin %> <%= command.id %> user roles',
		},
		{
			description: 'Add a user to a team',
			command: '<%= config.bin %> <%= command.id %> user add <team> <user> --role <role>',
		},
		{
			description: 'Change a user\'s role within a team',
			command: '<%= config.bin %> <%= command.id %> user update <team> <user> --role <role>',
		},
		{
			description: 'Remove a user from a team',
			command: '<%= config.bin %> <%= command.id %> user remove <team> <user>',
		},
	];

	static override authenticated = false;

	async run() {
		return this.help();
	}
}
