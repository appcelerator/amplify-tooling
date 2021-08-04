export default {
	aliases: [ 'ls' ],
	desc: 'Lists all service accounts',
	options: {
		'--account [name]': 'The account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs service accounts as JSON'
		}
	},
	async action({ argv, console }) {
		const { createTable, initPlatformAccount } = require('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);
		const { serviceAccounts } = await sdk.serviceAccount.list(account, org);

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				org,
				serviceAccounts
			}, null, 2));
			return;
		}

		const { default: snooplogg } = require('snooplogg');
		const { highlight, note } = snooplogg.styles;

		console.log(`Account:      ${highlight(account.name)}`);
		console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		if (!serviceAccounts.length) {
			console.log('No service accounts found');
			return;
		}

		const table = createTable([ 'Name', 'Client ID', 'Teams', 'Roles', 'Date Created' ]);

		for (const { client_id, created, name, roles, teams } of serviceAccounts) {
			table.push([
				name,
				client_id,
				teams,
				roles?.join(', ') || 'n/a',
				new Date(created).toLocaleDateString()
			]);
		}
		console.log(table.toString());
	}
};
