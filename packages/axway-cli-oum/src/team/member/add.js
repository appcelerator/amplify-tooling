export default {
	args: [
		{
			name: 'team',
			desc: 'The team identifier',
			required: true
		},
		{
			name: 'user',
			desc: 'The user guid or email address',
			required: true
		}
	],
	desc: 'Add a new member to a team',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': 'Outputs accounts as JSON',
		'--role [role]': {
			desc: 'Assign one or more team roles to a member',
			multiple: true
		}
	},
	async action({ argv, cli, console }) {
		const { initPlatformAccount } = require('../../lib/util');
		let { account, sdk } = await initPlatformAccount(argv.account);
		const { default: snooplogg } = require('snooplogg');
		const { highlight, note } = snooplogg.styles;

		const result = await sdk.team.member.add(account, argv.team, argv.user, argv.role);
		const org = await sdk.org.find(account, result.team.org_guid);

		if (!argv.json) {
			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
		}

		result.account = account.name;
		result.org = org;

		if (argv.json) {
			console.log(JSON.stringify(result, null, 2));
		} else {
			const name = `${result.user.firstname} ${result.user.lastname}`.trim();
			console.log(`Successfully added ${highlight(name)} to the ${highlight(result.team.name)} team`);
		}

		await cli.emitAction('axway:oum:team:member:add', result);
	}
};
