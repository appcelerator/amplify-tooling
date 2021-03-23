export default {
	aliases: [ 'rm' ],
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
	desc: 'Remove a member from a team',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, cli, console }) {
		const { initPlatformAccount } = require('../../lib/util');
		let { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);
		const { default: snooplogg } = require('snooplogg');
		const { highlight, note } = snooplogg.styles;

		if (!argv.json) {
			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
		}

		await sdk.team.member.remove(account, argv.team, argv.user);

		if (argv.json) {
			console.log(JSON.stringify({ success: true }, null, 2));
		} else {
			console.log('Successfully removed user from team');
		}

		await cli.emitAction('axway:oum:team:member:remove', {
			account: account.name,
			org,
			user: argv.user
		});
	}
};
