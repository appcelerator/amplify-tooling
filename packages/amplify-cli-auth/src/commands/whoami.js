export default {
	args: [
		{
			name: 'account-name',
			desc: 'the account to show'
		}
	],
	desc: 'Dumps info for the specified account',
	hidden: true,
	async action({ argv, console }) {
		const [
			{ APS },
			{ buildParams }
		] = await Promise.all([
			import('@axway/amplify-platform-sdk'),
			import('@axway/amplify-cli-utils')
		]);

		const params = buildParams({
			baseUrl:  argv.baseUrl,
			env:      argv.env,
			realm:    argv.realm
		});

		const accounts = await new APS(params).accounts.list();

		if (argv.accountName) {
			const account = accounts.find(a => a.name === argv.accountName);
			if (account) {
				console.log(JSON.stringify(account, null, 2));
			} else {
				console.log(JSON.stringify({
					code: 'ENOTFOUND',
					error: `Account "${argv.accountName}" not authenticated.`
				}, null, 2));
			}
		} else {
			console.log(JSON.stringify(accounts, null, 2));
		}
	}
};
