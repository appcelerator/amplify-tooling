import { initPlatformAccount } from '../../../lib/utils.js';
import { createTable } from '../../../lib/formatter.js';
import snooplogg from 'snooplogg';

export default {
	aliases: [ 'ls' ],
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid; defaults to the current org'
		}
	],
	desc: 'List users in an organization',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the list of users as JSON'
		}
	},
	async action({ argv, console }) {
		let { account, org, sdk } = await initPlatformAccount(argv.account, argv.org, argv.env);
		const { users } = await sdk.org.user.list(account, org);

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				org,
				users
			}, null, 2));
			return;
		}

		const { highlight, note } = snooplogg.styles;

		console.log(`Account:      ${highlight(account.name)}`);
		console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		if (!users.length) {
			console.log('No users found');
			return;
		}

		const table = createTable([ 'Name', 'Type', 'Email', 'GUID', 'Teams', 'Roles' ]);

		for (const { client_id, email, guid, name, roles, teams } of users) {
			table.push([
				name,
				client_id ? 'Service' : 'User',
				email,
				guid,
				teams,
				roles.length ? roles.join(', ') : note('n/a')
			]);
		}
		console.log(table.toString());
	}
};
