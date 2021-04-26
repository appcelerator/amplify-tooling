export default {
	desc: 'View available team user roles',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs roles as JSON'
		}
	},
	async action({ argv, console }) {
		const { createTable } = require('@axway/amplify-cli-utils');
		const { initPlatformAccount } = require('../../lib/util');
		let { account, sdk } = await initPlatformAccount(argv.account);
		const roles = (await sdk.role.list(account, { team: true })).filter(r => r.team && r.default);

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				roles
			}, null, 2));
			return;
		}

		const { default: snooplogg } = require('snooplogg');
		const { highlight } = snooplogg.styles;
		const table = createTable([ '  Role', 'Description' ]);

		for (const role of roles) {
			table.push([ `  ${highlight(role.id)}`, role.name ]);
		}

		console.log(`Account: ${highlight(account.name)}\n`);

		console.log('PLATFORM ROLES');
		console.log(table.toString());
	}
};
