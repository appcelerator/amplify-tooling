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
		'--json': 'Outputs revoked accounts as JSON'
	},
	async action({ argv, console }) {
		const [
			{ initSDK },
			{ default: snooplogg }
		] = await Promise.all([
			import('@axway/amplify-cli-utils'),
			import('snooplogg')
		]);

		if (!argv.accounts.length) {
			argv.all = true;
		}

		const { sdk } = initSDK();
		const revoked = await sdk.auth.logout(argv);

		if (argv.json) {
			console.log(JSON.stringify(revoked, null, 2));
			return;
		}

		// pretty output
		if (revoked.length) {
			const { highlight } = snooplogg.styles;
			console.log('Revoked authenticated accounts:');
			for (const account of revoked) {
				console.log(` ${highlight(account.name)}`);
			}
		} else if (Array.isArray(argv.accounts) && argv.accounts.length === 1) {
			console.log(`No account "${argv.accounts[0]}" to revoke`);
		} else {
			console.log('No accounts to revoke');
		}
	}
};
