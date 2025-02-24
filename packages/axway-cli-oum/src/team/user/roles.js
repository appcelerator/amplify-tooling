import { createTable, initPlatformAccount } from '@axway/amplify-cli-utils';
import snooplogg from 'snooplogg';

export default {
	desc: 'View available team user roles',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs roles as JSON'
		},
		'--org [name|id|guid]': 'The organization name, id, or guid; roles vary by org'
	},
	async action({ argv, console }) {
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org, argv.env);
		const roles = (await sdk.role.list(account, { default: true, org, team: true }));

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				org,
				roles
			}, null, 2));
			return;
		}

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
