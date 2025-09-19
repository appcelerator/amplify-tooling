import { initPlatformAccount } from '../../../lib/utils.js';
import { createTable } from '../../../lib/formatter.js';
import snooplogg from 'snooplogg';

export default {
	desc: 'View available organization user roles',
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
		const roles = (await sdk.role.list(account, { org }));

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				org,
				roles
			}, null, 2));
			return;
		}

		const { highlight, note } = snooplogg.styles;
		const platformRoles = createTable([ '  Role', 'Description' ]);
		const serviceRoles = createTable([ '  Role', 'Description', 'Product' ]);

		for (const role of roles) {
			if (role.default) {
				platformRoles.push([ `  ${highlight(role.id)}`, role.name ]);
			} else {
				serviceRoles.push([ `  ${highlight(role.id)}`, role.name, role.product || '' ]);
			}
		}

		console.log(`Account:      ${highlight(account.name)}`);
		console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		console.log('PLATFORM ROLES');
		console.log(platformRoles.toString());

		if (serviceRoles.length) {
			console.log('\nSERVICE ROLES');
			console.log(serviceRoles.toString());
		}
	}
};
