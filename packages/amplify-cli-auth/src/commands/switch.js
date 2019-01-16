export default {
	desc: 'select default account and organization',
	options: {
		'--account <name>': 'the account to switch to',
		'--json':           'outputs accounts as JSON',
		'--org <id|name>':  'the organization to switch to'
	},
	async action({ argv, console }) {
		const [ { auth }, inquirer, { getOrg } ] = await Promise.all([
			import('@axway/amplify-cli-utils'),
			import('inquirer'),
			import('../org-util')
		]);

		if (!argv.account && argv.json) {
			console.log(JSON.stringify({ error: 'Must specify --account when --json is set and there are multiple authenticated accounts' }, null, '  '));
			process.exit(1);
		}

		let account, accounts, client, config;

		try {
			({ account, accounts, client, config } = await auth.getAccount(argv.account));

			if (!account) {
				account = (await inquirer.prompt({
					type: 'list',
					name: 'selected',
					message: 'Please choose an account:',
					choices: accounts.map(acct => ({
						name: acct.name,
						value: acct
					}))
				})).selected;
			}
		} catch (err) {
			if (argv.json) {
				console.log(JSON.stringify({ error: err.message, code: err.code, accounts: err.accounts }, null, '  '));
			} else if (err.code === 'ERR_NO_ACCOUNTS') {
				console.error(`${err.message}:\n\n  amplify auth login`);
			} else {
				console.error(`${err.message}\n`);
				if (err.code === 'ERR_ACCOUNT_NOT_FOUND' && err.accounts) {
					console.error(`Authenticated accounts:\n${err.accounts.map(a => `  ${a.name}`).join('\n')}`);
				}
			}
			process.exit(1);
		}

		config.set('auth.defaultAccount', account.name);
		await config.save(config.userConfigFile);
		account.active = true;

		// deterimine the organization
		const org = await getOrg({ account, client, config, console, org: argv.org, json: argv.json });

		if (argv.json) {
			console.log(JSON.stringify(account, null, '  '));
		} else if (org) {
			console.log(`Default account set to ${account.user.email || account.name} in ${org.name}.`);
		} else {
			console.log(`Default account set to ${account.user.email || account.name}.`);
		}
	}
};
