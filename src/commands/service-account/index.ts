import Command from '../../lib/command.js';

export default class ServiceAccountCommand extends Command {
	static override hidden = true;
	static override summary = 'Create and manage service accounts.';
	static override description = `Create and manage service accounts, generate public/private keypairs, and assign teams.

When authenticating using a service account in a headless environment, such as a SSH terminal, you must set the token store type to "file":

  <%= config.bin %> config set auth.tokenStoreType file

Available roles can be viewed using the 'roles' subcommand.`;

	static override examples = [
		{
			description: 'List all service accounts',
			command: '<%= config.bin %> <%= command.id %> list'
		},
		{
			description: 'Create a service account with interactive prompting',
			command: '<%= config.bin %> <%= command.id %> create'
		},
		{
			description: 'Create a service account with minimum non-interactive arguments',
			command: '<%= config.bin %> <%= command.id %> create --name foo --secret bar'
		},
		{
			description: 'Change a service account name, description, and role',
			command: '<%= config.bin %> <%= command.id %> update <name/client-id> --name <new_name> --desc <desc> --role <role>'
		},
		{
			description: 'Add a team to an existing service account',
			command: '<%= config.bin %> <%= command.id %> add-team <client-id/name> <team_guid> <team_role>'
		},
		{
			description: 'Remove a team from a service account',
			command: '<%= config.bin %> <%= command.id %> remove-team <client-id/name> <team_guid>'
		},
		{
			description: 'Remove a service account',
			command: '<%= config.bin %> <%= command.id %> remove <client-id/name>'
		},
		{
			description: 'View available team roles',
			command: '<%= config.bin %> <%= command.id %> roles'
		}
	];

	async run() {
		return this.help();
	}
}
