export default {
	args: [
		{
			name: 'account',
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

		const client = new auth.Auth(params);

		if (argv.account) {
			const account = await client.getAccount({ account: argv.account });
			if (account) {
				console.log(JSON.stringify(account, null, '  '));
			} else {
				console.log(`Account "${argv.account}" not authenticated.`);
			}

		} else {
			const tokens = await client.list();
			console.log(JSON.stringify(tokens, null, '  '));
		}
	}
};
