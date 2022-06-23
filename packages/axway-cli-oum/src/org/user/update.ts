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
			name: 'user',
			desc: 'The user guid or email address',
			required: true
		}
	],
	desc: 'Update an user\'s organization roles',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
			desc: 'Outputs the result as JSON'
		},
		'--role [role]': {
			desc: 'Assign one or more organization roles to a user',
			multiple: true,
			redact: false
		}
	},
	async action({ argv, cli, console }: AxwayCLIState): Promise<void> {
		const { initPlatformAccount } = await import('@axway/amplify-cli-utils');
		let { account, org, sdk } = await initPlatformAccount(argv.account as string, argv.org as string, argv.env as string);
		const { default: snooplogg } = await import('snooplogg');
		const { highlight, note } = snooplogg.styles;

		if (!org.userRoles?.includes('administrator')) {
			throw new Error('You do not have administrative access to update an organization\'s user roles');
		}

		if (!argv.json) {
			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
		}

		const { roles, user } = await sdk.org.userUpdate(account, org, argv.user as string, argv.role as string[]);

		const results = {
			account: account.name,
			org,
			user
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const name = `${user?.firstname} ${user?.lastname}`.trim();
			console.log(`Successfully updated role${roles === 1 ? '' : 's'} for ${highlight(name)}`);
		}

		await cli.emitAction('axway:oum:org:user:update', results);
	}
};
