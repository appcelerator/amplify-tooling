import Command from '../../../lib/command.js';

export default class OrgUserCommand extends Command {
	static override hidden = true;
	static override aliases = [ 'org:users' ];
	static override summary = 'Manage organization users.';
	static override description = 'You may specify an organization by name, id, or guid.';
	static override examples = [
		{
			description: 'List all users in your currently selected organization',
			command: '<%= config.bin %> <%= command.id %> list'
		},
		{
			description: 'List all users for a specific organization',
			command: '<%= config.bin %> <%= command.id %> list <org>'
		},
		{
			description: 'View available user roles',
			command: '<%= config.bin %> <%= command.id %> roles'
		},
		{
			description: 'Add a user to an organization',
			command: '<%= config.bin %> <%= command.id %> add <org> <email> --role <role>'
		},
		{
			description: 'Change a user\'s role within an organization',
			command: '<%= config.bin %> <%= command.id %> update <org> <user> --role <role>'
		},
		{
			description: 'Remove a user from an organization',
			command: '<%= config.bin %> <%= command.id %> remove <org> <user>'
		}
	];

	async run() {
		return this.help();
	}
}
