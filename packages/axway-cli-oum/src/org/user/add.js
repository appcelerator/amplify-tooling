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
	desc: 'Add a new user to an organization',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': 'Outputs accounts as JSON',
		'--role [role]': {
			desc: 'Assign one or more team roles to a user',
			multiple: true,
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
