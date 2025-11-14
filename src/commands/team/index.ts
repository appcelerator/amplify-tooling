import Command from '../../lib/command.js';

export default class TeamCommand extends Command {
	static override hidden = true;

	static override summary = 'Manage Amplify Platform organization teams.';

	static override description = `You must be authenticated to view or manage organization teams.
Run "<%= config.bin %> auth login" to authenticate.

You may specify an organization by name, id, or guid as well as the team by name or guid.

For team user commands, you may refer to a user by email address or guid.`;

	static overrideexamples = [
		{
			description: 'List all organization teams',
			command: '<%= config.bin %> <%= command.id %> list <org>',
		},
		{
			description: 'View team details',
			command: '<%= config.bin %> <%= command.id %> view <org> <team>',
		},
		{
			description: 'Create a new team in an organization',
			command: '<%= config.bin %> <%= command.id %> create <org> <team name>',
		},
		{
			description: 'Update team information',
			command: '<%= config.bin %> <%= command.id %> update <org> <team> [options]',
		},
		{
			description: 'Remove a team',
			command: '<%= config.bin %> <%= command.id %> remove <org> <team>',
		},
		{
			description: 'List all users in a team',
			command: '<%= config.bin %> <%= command.id %> user list <org>',
		},
		{
			description: 'View available user roles',
			command: '<%= config.bin %> <%= command.id %> user roles',
		},
		{
			description: 'Add a user to a team',
			command: '<%= config.bin %> <%= command.id %> user add <org> <team> <user> --role <role>',
		},
		{
			description: 'Change a user\'s role within a team',
			command: '<%= config.bin %> <%= command.id %> user update <org> <team> <user> --role <role>',
		},
		{
			description: 'Remove a user from a team',
			command: '<%= config.bin %> <%= command.id %> user remove <org> <team> <user>',
		},
	];

	static override authenticated = false;

	async run() {
		return this.help();
	}
}
