import Command from '../../lib/command.js';
import { highlight } from '../../lib/logger.js';

export default class Auth extends Command {
	static override summary = 'Manage Axway CLI authentication.';

	static override description = `The Axway CLI auth command allows you to authenticate with the Amplify platform under one or more service accounts and switch between them. You can log in using one or more service accounts at the same time.

A service account can be used for both desktop and headless environments.
However, if authenticating in a headless environment, you must set the token store type to “file”:

  ${highlight('axway config set auth.tokenStoreType file')}`;

	static override examples = [
		{
			description: 'Log into a service account using a PEM formatted secret key',
			command: highlight('<%= config.bin %> <%= command.id %> login --client-id <id> --secret-file <path>')
		},
		{
			description: 'Log into a service account using a client secret',
			command: highlight('<%= config.bin %> <%= command.id %> login --client-id <id> --client-secret <token>')
		},
		{
			description: 'List all authenticated accounts',
			command: highlight('<%= config.bin %> <%= command.id %> list')
		},
		{
			description: 'Show the current default selected account',
			command: highlight('<%= config.bin %> <%= command.id %> whoami')
		},
		{
			description: 'Switch default account and org',
			command: highlight('<%= config.bin %> <%= command.id %> switch')
		},
		{
			description: 'Log out of an account',
			command: highlight('<%= config.bin %> <%= command.id %> logout')
		}
	];

	async run() {
		return this.config.runCommand('help', [ 'auth' ]);
	}
}
