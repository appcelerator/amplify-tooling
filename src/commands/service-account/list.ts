import { createTable, initPlatformAccount } from '../../lib/cli-utils/index.js';
import snooplogg from 'snooplogg';

export default {
	aliases: [ 'ls' ],
	desc: 'List all service accounts',
	help: {
		header() {
			return `${this.desc}.`;
		}
	},
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs service accounts as JSON'
		},
		'--org [name|id|guid]': 'The organization name, id, or guid'
	},
	async action({ argv, console }) {
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org, argv.env);
		const { clients } = await sdk.client.list(account, org);

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				org,
				clients
			}, null, 2));
			return;
		}

		const { highlight, note } = snooplogg.styles;

		console.log(`Account:      ${highlight(account.name)}`);
		console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		if (!clients.length) {
			console.log('No service accounts found');
			return;
		}

		const table = createTable([ 'Client ID', 'Name', 'Auth Method', 'Teams', 'Roles', 'Date Created' ]);

		for (const { client_id, created, method, name, roles, teams } of clients) {
			table.push([
				highlight(client_id),
				name,
				method,
				teams,
				roles?.join(', ') || 'n/a',
				new Date(created).toLocaleDateString()
			]);
		}
		console.log(table.toString());
	}
};
