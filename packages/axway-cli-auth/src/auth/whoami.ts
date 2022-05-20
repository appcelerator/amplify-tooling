export default {
	args: [
		{
			name: 'account-name',
			desc: 'The account to display'
		}
	],
	desc: 'Display info for an authenticated account',
	help: 'Display the currently selected account, organizations, roles, and teams.',
	options: {
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs accounts as JSON'
		}
	},
	async action({ argv, console }) {
		const { getAuthConfigEnvSpecifier, initSDK } = await import('@axway/amplify-cli-utils');
		const { renderAccountInfo } = await import('../lib/info');
		const { config, sdk } = await initSDK({
			baseUrl:  argv.baseUrl,
			env:      argv.env,
			realm:    argv.realm
		});
		const authConfigEnvSpecifier = getAuthConfigEnvSpecifier(sdk.env.name);
		let accounts = await sdk.auth.list({
			defaultTeams: config.get(`${authConfigEnvSpecifier}.defaultTeam`),
			validate: true
		});
		for (const account of accounts) {
			account.default = account.name === config.get(`${authConfigEnvSpecifier}.defaultAccount`);
		}

		if (argv.accountName) {
			// eslint-disable-next-line security/detect-non-literal-regexp
			const re = new RegExp(`${argv.accountName}`, 'i');
			accounts = accounts.filter(a => re.test(a.name) || re.test(a.user.email) || re.test(a.org.name));
		}

		if (argv.json) {
			console.log(JSON.stringify(accounts, null, 2));
		} else {
			const { default: snooplogg } = await import('snooplogg');
			const { highlight, note } = snooplogg.styles;

			if (accounts.length) {
				let account = accounts.find(a => a.default);
				if (!account) {
					account = accounts[0];
				}

				if (account.isPlatform && account.org?.name) {
					console.log(`You are logged into a ${highlight('platform')} account in organization ${highlight(account.org.name)} ${note(`(${account.org.guid})`)} as ${highlight(account.user.email || account.name)}.`);
				} else {
					console.log(`You are logged into a ${highlight('service')} account as ${highlight(account.user.email || account.name)}.`);
				}

				console.log(await renderAccountInfo(account, config, sdk));
			} else if (argv.accountName) {
				console.log(`The account ${highlight(argv.accountName)} is not logged in.`);
			} else {
				console.log('You are not logged in.');
			}
		}
	}
};
