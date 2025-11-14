import Command from '../../../lib/command.js';

export default class TeamUserCommand extends Command {
	static override hidden = true;

	static override aliases = [ 'team:users' ];

	static override summary = 'Manage team users.';

	static override description = `You may specify an organization by name, id, or guid as well as the team by
name or guid and user by email address or guid.`;

	static override examples = [
		{
			description: 'List all users in a team',
			command: '<%= config.bin %> <%= command.id %> list <org>',
		},
		{
			description: 'View available user roles',
			command: '<%= config.bin %> <%= command.id %> roles',
		},
		{
			description: 'Add a user to a team',
			command: '<%= config.bin %> <%= command.id %> add <org> <team> <user> --role <role>',
		},
		{
			description: 'Change a user\'s role within a team',
			command: '<%= config.bin %> <%= command.id %> update <org> <team> <user> --role <role>',
		},
		{
			description: 'Remove a user from a team',
			command: '<%= config.bin %> <%= command.id %> remove <org> <team> <user>',
		},
	];

	static override authenticated = false;

	async run() {
		return this.help();
	}
}
