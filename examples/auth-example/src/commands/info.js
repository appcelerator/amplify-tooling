export default {
	desc: 'Displays info about your authenticated account',
	options: {
		'--account [name]': 'The account to switch to'
	},
	async action({ argv, console }) {
		const { initSDK } = await import('@axway/amplify-cli-utils');
		const { config, sdk } = initSDK();
		const accounts = await sdk.auth.list();

		if (accounts.length) {
			console.log(`Found ${accounts.length} authenticated account${accounts.length === 1 ? '' : 's'}:`);
			for (const account of accounts) {
				console.log(`  ${account.name}`);
			}
		} else {
			console.log('No authenticated accounts found');
		}

		console.log();

		try {
			const account = await sdk.auth.find(argv.account);

			const defaultAccount = config.get('auth.defaultAccount');
			console.log(defaultAccount ? `Default account: ${defaultAccount}\n` : 'No default account\n');

			if (account) {
				console.log(`${argv.account ? 'Selected' : 'Default'} account info:`);
				console.log(account);
			} else if (argv.account) {
				console.log(`Account "${argv.account}" not found`);
			}
		} catch (err) {
			console.error(err.toString());
		}
	}
};
