import { highlight } from '../../lib/logger.js';
import Command from '../../lib/command.js';

export default class OrgCommand extends Command {
	static override hidden = true;

	static override summary = 'Manage Amplify Platform organizations.';

	static override description = `You must be authenticated to view or manage organizations.
Run ${highlight('"<%= config.bin %> auth login"')} to authenticate.

You may specify an organization by name, id, or guid.`;

	static override examples = [
		{
			command: '<%= config.bin %> <%= command.id %> list',
			description: 'List organizations'
		},
		{
			command: '<%= config.bin %> <%= command.id %> view',
			description: 'View your currently selected organization\'s details'
		},
		{
			command: '<%= config.bin %> <%= command.id %> view <org>',
			description: 'View a specific organization\'s details'
		},
		{
			command: '<%= config.bin %> <%= command.id %> rename <org> <new name>',
			description: 'Rename an organization'
		},
		{
			command: '<%= config.bin %> <%= command.id %> activity <org>',
			description: 'View activity report for a specific organization'
		},
		{
			command: '<%= config.bin %> <%= command.id %> usage <org>',
			description: 'View usage report for a specific organization'
		},
		{
			command: '<%= config.bin %> <%= command.id %> user list',
			description: 'List users in your currently selected organization'
		},
		{
			command: '<%= config.bin %> <%= command.id %> user list <org>',
			description: 'List users for a specific organization'
		},
		{
			command: '<%= config.bin %> <%= command.id %> user roles',
			description: 'View available user roles'
		},
		{
			command: '<%= config.bin %> <%= command.id %> user add <org> <email> --role <role>',
			description: 'Add a user to an organization'
		},
		{
			command: '<%= config.bin %> <%= command.id %> user update <org> <user> --role <role>',
			description: 'Change a user\'s role within an organization'
		},
		{
			command: '<%= config.bin %> <%= command.id %> user remove <org> <user>',
			description: 'Remove a user from an organization'
		}
	];

	static override authenticated = false;

	async run() {
		return this.help();
	}
}
