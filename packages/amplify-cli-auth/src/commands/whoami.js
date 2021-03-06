export default {
	args: [
		{
			name: 'account-name',
			desc: 'The account to display'
		}
	],
	desc: 'Display info for an authenticated account',
	options: {
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs accounts as JSON'
		}
	},
	async action({ argv, console }) {
		const { initSDK } = await import('@axway/amplify-cli-utils');
		const { sdk } = initSDK({
			baseUrl:  argv.baseUrl,
			clientId: argv.clientId,
			env:      argv.env,
			realm:    argv.realm
		});
		let accounts = await sdk.auth.list();

		if (argv.accountName) {
			// eslint-disable-next-line security/detect-non-literal-regexp
			const re = new RegExp(`${argv.accountName}`, 'i');
			accounts = accounts.filter(a => re.test(a.name) || re.test(a.user.email) || re.test(a.org.name));
		}

		if (argv.json) {
			console.log(JSON.stringify(accounts, null, 2));
		} else {
			const { default: snooplogg } = require('snooplogg');
			const { highlight } = snooplogg.styles;
			if (accounts.length) {
				for (const account of accounts) {
					if (account.isPlatform && account.org?.name) {
						console.log(`You are logged into ${highlight(account.org.name)} as ${highlight(account.user.email || account.name)}.`);
					} else {
						console.log(`You are logged in as ${highlight(account.user.email || account.name)}.`);
					}
				}
			} else if (argv.accountName) {
				console.log(`The account ${highlight(argv.accountName)} is not logged in.`);
			} else {
				console.log('You are not logged in.');
			}
		}
	}
};
