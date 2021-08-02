export default {
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid',
			required: true
		},
		{
			name: 'email',
			desc: 'The email address for the user to add',
			required: true
		}
	],
	desc: 'Adds or invites a user to an organization',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer({ style }) {
			return `${style.heading('Examples:')}

  You may specify an organization by name, id, or guid.

  If the user is not already a platform user, they will automatically be
  invited to create a platform account and join the organization.

  An organization user must be assigned a platform role and optionally a
  product specific role. You may specify the roles with multiple ${style.highlight('--role "role"')}
  options or a single ${style.highlight('--role "role1,role2,role3"')} option with a comma-separated
  list of roles. To view available user roles, run: ${style.highlight('axway org user roles')}

  Add a user to an organization with administrator privileges.
    ${style.highlight('axway org user add <org> <email> --role administrator')}`;
		}
	},
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the result as JSON'
		},
		'--role [role]': {
			desc: 'Assign one or more organization roles to a user',
			multiple: true,
			redact: false,
			required: true
		}
	},
	async action({ argv, cli, console }) {
		const { initPlatformAccount } = require('../../lib/util');
		let { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);
		const { default: snooplogg } = require('snooplogg');
		const { highlight, note } = snooplogg.styles;

		if (!org.userRoles.includes('administrator')) {
			throw new Error('You do not have administrative access to add users to the organization');
		}

		if (!argv.json) {
			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
		}

		const { user } = await sdk.org.user.add(account, org, argv.email, argv.role);
		const results = {
			account: account.name,
			org,
			user
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const name = `${results.user.firstname} ${results.user.lastname}`.trim();
			console.log(`Successfully added ${highlight(name)} to ${highlight(org.name)}`);
		}

		await cli.emitAction('axway:oum:org:user:add', results);
	}
};
