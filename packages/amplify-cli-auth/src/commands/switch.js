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
		const accounts = await auth.list();
		let hash = null;

		const errorNoCredentials = () => {
			const error = 'No credentials found, please login';
			if (argv.json) {
				console.log(JSON.stringify({ error }, null, '  '));
			} else {
				console.error(`${error}:\n\n  amplify auth login`);
			}
			process.exit(1);
		};

		if (!accounts.length) {
			errorNoCredentials();
		} else if (argv.account) {
			for (const account of accounts) {
				if (account.name === argv.account) {
					hash = account.hash;
					break;
				}
			}
			if (!hash) {
				const error = `Unable to find account: ${argv.account}`;
				if (argv.json) {
					console.log(JSON.stringify({ error }, null, '  '));
				} else {
					console.error(`${error}\nAuthenticated accounts:\n${accounts.map(a => `  ${a.name}`).join('\n')}`);
				}
				process.exit(1);
			}
		} else if (accounts.length === 1) {
			hash = accounts[0].hash;
		} else if (argv.json) {
			console.log(JSON.stringify({ error: 'Must specify --account when --json is set and there are multiple authenticated accounts' }, null, '  '));
			process.exit(1);
		} else if (accounts.length > 1) {
			const { selected } = await inquirer.prompt({
				type: 'list',
				name: 'selected',
				message: 'Please choose an account:',
				choices: accounts.map(acct => ({
					name: acct.name,
					value: acct
				}))
			});
			hash = selected.hash;
		}

		const { account, client, config } = await auth.getAccount(hash);

		if (!account) {
			errorNoCredentials();
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
