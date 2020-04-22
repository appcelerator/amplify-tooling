export default {
	aliases: [ 'revoke' ],
	args: [
		{
			name: 'accounts...',
			desc: 'One or more specific accounts to revoke credentials'
		}
	],
	desc: 'Log out all or specific accounts from the AMPLIFY platform',
	options: {
		'-a, --all': 'revoke all credentials; supersedes list of accounts',
		'--json': 'Outputs revoked accounts as JSON'
	},
	async action({ argv, console }) {
		const [
			{ AmplifySDK },
			{ buildParams }
		] = await Promise.all([
			import('@axway/amplify-sdk'),
			import('@axway/amplify-cli-utils')
		]);

		if (!argv.accounts.length && !argv.all) {
			throw new Error('Missing list of accounts to revoke or `--all` flag');
		}

		const revoked = await new AmplifySDK(buildParams()).auth.logout(argv);

		if (argv.json) {
			console.log(JSON.stringify(revoked, null, 2));
			return;
		}

		// pretty output
		if (revoked.length) {
			console.log('Revoked authenticated accounts:');
			for (const account of revoked) {
				console.log(` * ${account.name}`);
			}
		} else if (Array.isArray(argv.accounts) && argv.accounts.length === 1) {
			console.log(`No account "${argv.accounts[0]}" to revoke.`);
		} else {
			console.log('No credentialed accounts to revoke.');
		}
	}
};
