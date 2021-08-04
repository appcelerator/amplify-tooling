export default {
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
	desc: 'Add a user to a team',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer({ style }) {
			return `${style.heading('Examples:')}

  You may specify an organization by name, id, or guid.

  The user must already be a platform user.

  An team user must be assigned a platform role and optionally a product
  specific role. You may specify the roles with multiple ${style.highlight('--role "role"')} options
  or a single ${style.highlight('--role "role1,role2,role3"')} option with a comma-separated list of
  roles. To view available user roles, run: ${style.highlight('axway team user roles')}

  Add a user to an organization with administrator privileges.
    ${style.highlight('axway team user add <org> <email> --role administrator')}`;
		}
	},
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the result as JSON'
		},
		'--role <role>': {
			desc: 'Assign one or more team roles to a user',
			multiple: true,
			redact: false
		}
	},
	async action({ argv, cli, console }) {
		const { initPlatformAccount } = require('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);

		if (!org.userRoles.includes('administrator')) {
			throw new Error(`You do not have administrative access to add a user to a team in the "${org.name}" organization`);
		}

		const results = {
			account: account.name,
			...(await sdk.team.user.add(account, org, argv.team, argv.user, argv.role))
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const { default: snooplogg } = require('snooplogg');
			const { highlight, note } = snooplogg.styles;
			const name = `${results.user.firstname} ${results.user.lastname}`.trim();

			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
			console.log(`Successfully added ${highlight(name)} to the ${highlight(results.team.name)} team`);
		}

		await cli.emitAction('axway:oum:team:user:add', results);
	}
};
