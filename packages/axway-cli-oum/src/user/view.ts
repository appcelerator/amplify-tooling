import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';

export default {
	aliases: [ '!info' ],
	desc: 'Display your user information',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
			desc: 'Outputs the info as JSON'
		}
	},
	async action({ argv, console }: AxwayCLIState): Promise<void> {
		const { initPlatformAccount } = await import('@axway/amplify-cli-utils');
		const { account } = await initPlatformAccount(argv.account as string, argv.org as string, argv.env as string);
		const { user } = account;

		if (argv.json) {
			console.log(JSON.stringify(user, null, 2));
			return;
		}

		const { default: snooplogg } = await import('snooplogg');
		const { highlight } = snooplogg.styles;

		console.log(`First Name:   ${highlight(user.firstname)}`);
		console.log(`Last Name:    ${highlight(user.lastname)}`);
		console.log(`Email:        ${highlight(user.email)}`);
		console.log(`Date Joined:  ${highlight(user.dateJoined ? new Date(user.dateJoined).toLocaleDateString() : 'n/a')}`);
		console.log(`GUID:         ${highlight(user.guid)}`);
	}
};
