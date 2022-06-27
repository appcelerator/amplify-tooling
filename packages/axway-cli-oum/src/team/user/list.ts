import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';

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
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
			desc: 'Outputs the list of users as JSON'
		}
	},
	async action({ argv, console }: AxwayCLIState): Promise<void> {
		const { initPlatformAccount } = await import('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(argv.account as string, argv.org as string, argv.env as string);
		const { team } = await sdk.team.find(account, org, argv.team as string);

		if (!team) {
			throw new Error(`Unable to find team "${argv.team}"`);
		}

		const { users } = await sdk.team.userList(account, org, team.guid);

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				org,
				team,
				users
			}, null, 2));
			return;
		}

		const { default: snooplogg } = await import('snooplogg');
		const { highlight, note } = snooplogg.styles;

		console.log(`Account:      ${highlight(account.name)}`);
		console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}`);
		console.log(`Team:         ${highlight(team.name)} ${note(`(${team.guid})`)}\n`);

		if (!users.length) {
			console.log('No users found');
			return;
		}

		const { createTable } = await import('@axway/amplify-cli-utils');
		const table = createTable([ 'Name', 'Type', 'Email', 'GUID', 'Roles' ]);

		for (const { email, guid, name, roles, type } of users) {
			table.push([
				name,
				type === 'client' ? 'Service' : type === 'user' ? 'User' : type,
				email,
				guid,
				roles.length ? roles.join(', ') : note('n/a')
			]);
		}
		console.log(table.toString());
	}
};
