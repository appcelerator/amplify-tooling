export default {
	desc: 'View available organization user roles',
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
		const roles = (await sdk.role.list(account)).filter(r => r.org);

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				roles
			}, null, 2));
			return;
		}

		const { default: snooplogg } = require('snooplogg');
		const { highlight } = snooplogg.styles;
		const platformRoles = createTable([ '  Role', 'Description' ]);
		const additionalRoles = createTable([ '  Role', 'Description', 'Product' ]);

		for (const role of roles) {
			if (role.default) {
				platformRoles.push([ `  ${highlight(role.id)}`, role.name ]);
			} else {
				additionalRoles.push([ `  ${highlight(role.id)}`, role.name, role.product || '' ]);
			}
		}

		console.log(`Account: ${highlight(account.name)}\n`);

		console.log('PLATFORM ROLES');
		console.log(platformRoles.toString());

		console.log('\nPRODUCT SPECIFIC ROLES');
		console.log(additionalRoles.toString());
	}
};
