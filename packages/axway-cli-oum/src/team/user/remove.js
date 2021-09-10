export default {
	aliases: [ 'rm' ],
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
		},
		{
			name: 'user',
			desc: 'The user guid or email address',
			required: true
		}
	],
	desc: 'Remove a user from a team',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the result as JSON'
		}
	},
	async action({ argv, cli, console }) {
		const { initPlatformAccount } = require('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org, argv.env);

		if (!org.userRoles.includes('administrator')) {
			throw new Error(`You do not have administrative access to remove a user from a team in the "${org.name}" organization`);
		}

		const { team, user } = await sdk.team.user.remove(account, org, argv.team, argv.user);

		const results = {
			account: account.name,
			org,
			team,
			user
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const { default: snooplogg } = require('snooplogg');
			const { highlight, note } = snooplogg.styles;
			const name = `${user.firstname} ${user.lastname}`.trim();

			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
			console.log(`Successfully removed user ${highlight(name)} from the ${highlight(team.name)} team`);
		}

		await cli.emitAction('axway:oum:team:user:remove', results);
	}
};
