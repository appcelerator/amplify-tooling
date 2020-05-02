export default {
	args: [
		{
			name: 'account-name',
			desc: 'The account to display'
		}
	],
	desc: 'Dumps info for the specified account',
	hidden: true,
	async action({ argv, console }) {
		const { initSDK } = await import('@axway/amplify-cli-utils');
		const { sdk } = initSDK({
			baseUrl:  argv.baseUrl,
			env:      argv.env,
			realm:    argv.realm
		});
		const accounts = await sdk.auth.list();

		if (argv.accountName) {
			const account = accounts.find(a => a.name === argv.accountName);
			if (account) {
				console.log(JSON.stringify(account, null, 2));
			} else {
				console.log(JSON.stringify({
					code: 'ENOTFOUND',
					error: `Account "${argv.accountName}" not authenticated`
				}, null, 2));
			}
		} else {
			console.log(JSON.stringify(accounts, null, 2));
		}
	}
};
