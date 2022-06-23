import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';

export default {
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid; defaults to the current org',
			required: true
		},
		{
			name: 'name',
			desc: 'The new organization name',
			required: true
		}
	],
	desc: 'Rename an organization',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
			desc: 'Outputs the result as JSON'
		}
	},
	async action({ argv, cli, console }: AxwayCLIState): Promise<void> {
		const { initPlatformAccount } = await import('@axway/amplify-cli-utils');
		const { default: snooplogg } = await import('snooplogg');
		const { highlight } = snooplogg.styles;
		const { account, org, sdk } = await initPlatformAccount(argv.account as string, argv.org as string, argv.env as string);

		if (!org.userRoles?.includes('administrator')) {
			throw new Error('You do not have administrative access to rename the organization');
		}

		const result = await sdk.org.rename(account, org, argv.name as string);

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				...result
			}, null, 2));
		} else {
			console.log(`Account: ${highlight(account.name)}\n`);
			console.log(`Successfully renamed "${result.oldName}" to "${result.name}"`);
		}

		await cli.emitAction('axway:oum:org:rename', result);
	}
};
