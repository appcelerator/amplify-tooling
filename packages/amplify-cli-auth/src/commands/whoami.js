export default {
	args: [
		{
			name: 'account-name',
			desc: 'the account to show'
		}
	],
	desc: 'dumps info for the specified account',
	hidden: true,
	async action({ argv, console }) {
		const { auth } = await import('@axway/amplify-cli-utils');

		const params = auth.buildParams({
			baseUrl:  argv.baseUrl,
			env:      argv.env,
			realm:    argv.realm
		});

		const client = auth.createAuth(params);

		if (argv.accountName) {
			const account = await client.getAccount({ accountName: argv.accountName });
			if (account) {
				console.log(JSON.stringify(account, null, '  '));
			} else {
				console.log(`Account "${argv.accountName}" not authenticated.`);
			}

		} else {
			const tokens = await client.list();
			console.log(JSON.stringify(tokens, null, '  '));
		}
	}
};
