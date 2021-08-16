export default {
	desc: 'View available service account roles',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs service accounts as JSON'
		},
		'--org [name|id|guid]': 'The organization name, id, or guid; roles vary by org'
	},
	async action({ argv, console }) {
		const { createTable, initPlatformAccount } = require('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);
		const roles = await sdk.role.list(account, { client: true, org });

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				org,
				roles
			}, null, 2));
			return;
		}

		const { default: snooplogg } = require('snooplogg');
		const { highlight, note } = snooplogg.styles;
		const table = createTable([ '  Role', 'Description' ]);

		for (const role of roles) {
			table.push([ `  ${highlight(role.id)}`, role.name ]);
		}

		console.log(`Account:      ${highlight(account.name)}`);
		console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		console.log('PLATFORM ROLES');
		console.log(table.toString());
	}
};
