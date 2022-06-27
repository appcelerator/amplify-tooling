import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';

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
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
			desc: 'Outputs the result as JSON'
		},
		'--role [role]': {
			desc: 'Assign one or more team roles to a user',
			multiple: true,
			redact: false
		}
	},
	async action({ argv, cli, console }: AxwayCLIState): Promise<void> {
		const { initPlatformAccount } = await import('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(argv.account as string, argv.org as string, argv.env as string);

		if (!org.userRoles?.includes('administrator')) {
			throw new Error(`You do not have administrative access to update a user's team roles in the "${org.name}" organization`);
		}

		const { team, user } = await sdk.team.userUpdate(account, org, argv.team as string, argv.user as string, argv.role as string[]);

		const results = {
			account,
			org,
			team,
			user
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const { default: snooplogg } = await import('snooplogg');
			const { highlight, note } = snooplogg.styles;

			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
			console.log(`Successfully updated user role${user.roles.length === 1 ? '' : 's'}`);
		}

		await cli.emitAction('axway:oum:team:user:update', results);
	}
};
