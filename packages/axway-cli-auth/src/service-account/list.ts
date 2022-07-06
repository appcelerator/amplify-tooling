import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';
import { CLICommand } from 'cli-kit';

export default {
	aliases: [ 'ls' ],
	desc: 'List all service accounts',
	help: {
		header(this: CLICommand) {
			return `${this.desc}.`;
		}
	},
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
			desc: 'Outputs service accounts as JSON'
		},
		'--org [name|id|guid]': 'The organization name, id, or guid'
	},
	async action({ argv, console }: AxwayCLIState): Promise<void> {
		const { createTable, initPlatformAccount } = await import('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(
			argv.account as string,
			argv.org as string,
			argv.env as string
		);
		const { clients } = await sdk.client.list(account, org);

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				org,
				clients
			}, null, 2));
			return;
		}

		const { default: snooplogg } = await import('snooplogg');
		const { highlight, note } = snooplogg.styles;

		console.log(`Account:      ${highlight(account.name)}`);
		console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		if (!clients.length) {
			console.log('No service accounts found');
			return;
		}

		const table = createTable([ 'Client ID', 'Name', 'Auth Method', 'Teams', 'Roles', 'Date Created' ]);

		for (const { client_id, created, method, name, roles, team_count } of clients) {
			table.push([
				highlight(client_id),
				name,
				method,
				team_count,
				roles?.join(', ') || 'n/a',
				new Date(created).toLocaleDateString()
			]);
		}
		console.log(table.toString());
	}
};
