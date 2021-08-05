export default {
	aliases: [ '!revoke' ],
	args: [
		{
			name: 'accounts...',
			desc: 'One or more specific accounts to revoke credentials'
		}
	],
	desc: 'Log out all or specific accounts',
	options: {
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs revoked accounts as JSON'
		}
	},
	async action({ argv, cli, console }) {
		const [
			{ initSDK, isHeadless },
			{ default: snooplogg }
		] = await Promise.all([
			import('@axway/amplify-cli-utils'),
			import('snooplogg')
		]);

		if (!argv.accounts.length) {
			argv.all = true;
		}

		const { highlight, warning } = snooplogg.styles;

		const { sdk } = initSDK({
			baseUrl:  argv.baseUrl,
			env:      argv.env,
			realm:    argv.realm
		});
		const revoked = await sdk.auth.logout({
			...argv,
			onOpenBrowser() {
				if (isHeadless()) {
					console.log(warning(' ┃ Logging out of a platform account requires a web browser and is unsupported'));
					console.log(warning(' ┃ in headless environments.\n'));
				}
			}
		});

		await cli.emitAction('axway:auth:logout', revoked);

		if (argv.json) {
			console.log(JSON.stringify(revoked, null, 2));
			return;
		}

		// pretty output
		if (revoked.length) {
			console.log('Revoked authenticated accounts:');
			for (const account of revoked) {
				console.log(` ${highlight(account.name)}`);
			}
		} else if (Array.isArray(argv.accounts) && argv.accounts.length === 1) {
			throw new Error(`No account "${argv.accounts[0]}" found`);
		} else {
			throw new Error('No authenticated accounts found');
		}
	}
};
