import { initPlatformAccount } from '../../../lib/utils.js';
import { createTable } from '../../../lib/formatter.js';
import snooplogg from 'snooplogg';

export default {
	aliases: [ 'ls' ],
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid',
			required: true
		},
		{
			name: 'team',
			desc: 'The team name or guid',
			required: true
		}
	],
	desc: 'List users in a team',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the list of users as JSON'
		}
	},
	async action({ argv, console }) {
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org, argv.env);
		const { team } = await sdk.team.find(account, org, argv.team);

		if (!team) {
			throw new Error(`Unable to find team "${argv.team}"`);
		}

		const { users } = await sdk.team.user.list(account, org, team.guid);

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				org,
				team,
				users
			}, null, 2));
			return;
		}

		const { highlight, note } = snooplogg.styles;

		console.log(`Account:      ${highlight(account.name)}`);
		console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}`);
		console.log(`Team:         ${highlight(team.name)} ${note(`(${team.guid})`)}\n`);

		if (!users.length) {
			console.log('No users found');
			return;
		}

		const table = createTable([ 'Name', 'Type', 'Email', 'GUID', 'Teams', 'Roles' ]);

		for (const { email, guid, name, roles, teams, type } of users) {
			table.push([
				name,
				type === 'client' ? 'Service' : type === 'user' ? 'User' : type,
				email,
				guid,
				teams,
				roles.length ? roles.join(', ') : note('n/a')
			]);
		}
		console.log(table.toString());
	}
};
