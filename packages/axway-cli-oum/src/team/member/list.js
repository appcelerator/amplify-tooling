export default {
	aliases: [ 'ls' ],
	args: [
		{
			name: 'team',
			desc: 'The team identifier',
			required: true
		}
	],
	desc: 'List all members in a team',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		const { initPlatformAccount } = require('../../lib/util');
		const { createTable } = require('@axway/amplify-cli-utils');
		let { account, sdk } = await initPlatformAccount(argv.account);
		const team = await sdk.team.find(account, argv.team);
		const org = await sdk.org.find(account, team.org_guid);
		const members = await sdk.team.member.list(account, team.guid);

		if (argv.json) {
			console.log(JSON.stringify(members, null, 2));
			return;
		}

		const { default: snooplogg } = require('snooplogg');
		const { highlight, note } = snooplogg.styles;

		console.log(`Account:      ${highlight(account.name)}`);
		console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}`);
		console.log(`Team:         ${highlight(team.name)} ${note(`(${team.guid})`)}\n`);

		if (!members.length) {
			console.log('No members found');
			return;
		}

		const table = createTable([ 'Member', 'Email', 'GUID', 'Teams', 'Roles' ]);

		for (const { email, guid, name, roles, teams } of members) {
			table.push([
				name,
				email,
				guid,
				teams,
				roles.length ? roles.join(', ') : note('n/a')
			]);
		}
		console.log(table.toString());
	}
};
