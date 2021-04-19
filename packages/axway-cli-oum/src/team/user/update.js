export default {
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid',
			required: true
		},
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
	desc: 'Update an user\'s team roles',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs accounts as JSON'
		},
		'--role [role]': {
			desc: 'Assign one or more team roles to a user',
			multiple: true
		}
	},
	async action({ argv, cli, console }) {
		const { initPlatformAccount } = require('../../lib/util');
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);

		if (!org.userRoles.includes('administrator')) {
			throw new Error(`You do not have administrative access to update a user's team roles in the "${org.name}" organization`);
		}

		const results = {
			account: account.name,
			org,
			...(await sdk.team.user.update(account, org, argv.team, argv.user, argv.role))
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const { default: snooplogg } = require('snooplogg');
			const { highlight, note } = snooplogg.styles;

			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
			console.log(`Successfully updated user role${results.roles === 1 ? '' : 's'}`);
		}

		await cli.emitAction('axway:oum:team:user:update', results);
	}
};
