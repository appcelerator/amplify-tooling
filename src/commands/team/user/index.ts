import Command from '../../../lib/command.js';

export default class TeamUserCommand extends Command {
	static override hidden = true;

	static override aliases = [ 'team:users' ];

	static override summary = 'Manage team users.';

	static override description = 'You may specify the team by name or guid, user by email address or guid, or service account by guid or client id.';

	static override examples = [
		{
			description: 'List all users in a team',
			command: '<%= config.bin %> <%= command.id %> list',
		},
		{
			description: 'View available user roles',
			command: '<%= config.bin %> <%= command.id %> roles',
		},
		{
			description: 'Add a user or service account to a team',
			command: '<%= config.bin %> <%= command.id %> add <team> <user> --role <role>',
		},
		{
			description: 'Change a user or service account\'s role within a team',
			command: '<%= config.bin %> <%= command.id %> update <team> <user> --role <role>',
		},
		{
			description: 'Remove a user or service account from a team',
			command: '<%= config.bin %> <%= command.id %> remove <team> <user>',
		},
	];

	static override authenticated = false;

	async run() {
		return this.help();
	}
}
