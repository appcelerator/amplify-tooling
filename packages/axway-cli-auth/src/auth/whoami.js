export default {
	args: [
		{
			name: 'account-name',
			desc: 'The account to display'
		}
	],
	desc: 'Display info for an authenticated account',
	options: {
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs accounts as JSON'
		}
	},
	async action({ argv, console }) {
		const { createTable, getAuthConfigEnvSpecifier, initSDK } = await import('@axway/amplify-cli-utils');
		const { config, sdk } = initSDK({
			baseUrl:  argv.baseUrl,
			env:      argv.env,
			realm:    argv.realm
		});
		let accounts = await sdk.auth.list({ validate: true });
		for (const account of accounts) {
			account.default = account.name === config.get(`${getAuthConfigEnvSpecifier(account.auth.env)}.defaultAccount`);
		}

		if (argv.accountName) {
			// eslint-disable-next-line security/detect-non-literal-regexp
			const re = new RegExp(`${argv.accountName}`, 'i');
			accounts = accounts.filter(a => re.test(a.name) || re.test(a.user.email) || re.test(a.org.name));
		}

		if (argv.json) {
			console.log(JSON.stringify(accounts, null, 2));
		} else {
			const { default: snooplogg } = require('snooplogg');
			const { highlight, note } = snooplogg.styles;

			if (accounts.length) {
				let acct;

				for (const account of accounts) {
					if (account.isPlatform && account.org?.name) {
						console.log(`You are logged into ${highlight(account.org.name)} ${note(`(${account.org.guid})`)} as ${highlight(account.user.email || account.name)}`);
					} else {
						console.log(`You are logged in as ${highlight(account.user.email || account.name)}`);
					}
					if (account.default) {
						acct = account;
					}
				}

				const table = createTable();

				if (acct.roles.length) {
					const roles = await sdk.role.list(acct);
					table.push([ 'Org Roles:', highlight(acct.roles.map(role => roles.find(r => r.id === role)?.name || role).join(', ')) ]);
				}

				if (acct.team) {
					table.push([ 'Team:', `${highlight(acct.team.name)} ${note(`(${acct.team.guid})`)}` ]);
					if (acct.team.roles.length) {
						const roles = await sdk.role.list(acct, { team: true });
						table.push([ 'Team Roles:', highlight(acct.team.roles.map(role => roles.find(r => r.id === role)?.name || role).join(', ')) ]);
					}
				}

				table.push([ 'Region:', highlight(config.get('region', acct.org?.region || 'US')) ]);
				console.log(table.toString());
			} else if (argv.accountName) {
				console.log(`The account ${highlight(argv.accountName)} is not logged in.`);
			} else {
				console.log('You are not logged in.');
			}
		}
	}
};
