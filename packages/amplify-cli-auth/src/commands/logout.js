export default {
	aliases: [ 'revoke' ],
	args: [
		{
			name: 'accounts...',
			desc: 'one or more specific accounts to revoke credentials'
		}
	],
	desc: 'log out of the AMPLIFY platform',
	options: {
		'-a, --all': {
			desc: 'revoke all credentials'
		}
	},
	async action({ argv, console }) {
		const { auth } = await import('@axway/amplify-cli-utils');

		if (!argv.accounts.length && !argv.all) {
			throw new Error('Missing list of accounts to revoke or `--all` flag');
		}

		const {
			keytarServiceName,
			tokenRefreshThreshold,
			tokenStoreDir,
			tokenStoreType
		} = auth.buildParams();

		const client = new auth.Auth({
			keytarServiceName,
			tokenRefreshThreshold,
			tokenStoreDir,
			tokenStoreType
		});

		const revoked = await client.revoke({
			accounts: argv.all ? 'all' : argv.accounts,
			baseUrl: argv.baseUrl
		});

		// pretty output
		if (revoked.length) {
			console.log('Revoked authenticated accounts:');
			for (const account of revoked) {
				console.log(` * ${account.email}`);
			}
		} else if (Array.isArray(argv.accounts) && argv.accounts.length === 1) {
			console.log(`Account "${argv.accounts[0]}" not credentialed.`);
		} else {
			console.log('No credentialed accounts to revoke.');
		}
	}
};
