import { initPlatformAccount } from '../../../lib/utils.js';
import { highlight, note } from '../../../lib/logger.js';

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
	desc: 'Update an user\'s team roles',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the result as JSON'
		},
		'--role [role]': {
			desc: 'Assign one or more team roles to a user',
			multiple: true,
			redact: false
		}
	},
	async action({ argv, cli, console }) {
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org, argv.env);

		if (!account.user.roles.includes('administrator')) {
			throw new Error(`You do not have administrative access to update a user's team roles in the "${org.name}" organization`);
		}

		const { team, user } = await sdk.team.user.update(account, org, argv.team, argv.user, argv.role);

		const results = {
			account: account.name,
			org,
			team,
			user
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
			// TODO: Fix this bug with roles never being defined on the results object
			// console.log(`Successfully updated user role${results.roles === 1 ? '' : 's'}`);
		}

		await cli.emitAction('axway:oum:team:user:update', results);
	}
};
