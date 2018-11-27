export default {
	desc: 'select default account and organization',
	options: {
		'--json': 'outputs accounts as JSON'
	},
	async action({ argv, console }) {
		const [ { auth }, inquirer ] = await Promise.all([
			import('@axway/amplify-cli-utils'),
			import('inquirer')
		]);
		const accounts = await auth.list();
		let hash = null;

		if (accounts.length > 1) {
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
		} else if (accounts.length === 1) {
			hash = accounts[0].hash;
		} else {
			console.log('No credentials found, please login:\n\n  amplify auth login');
			process.exit(1);
		}

		const { account, client, config } = await auth.getAccount({ hash });

		config.set('auth.defaultAccount', account.name);
		await config.save(config.userConfigFile);
		account.active = true;

		// deterimine the organization
		let org = null;
		if (account.orgs.length > 1) {
			const { selected } = await inquirer.prompt({
				type: 'list',
				name: 'selected',
				message: 'Please choose an organization:',
				choices: account.orgs.map(org => ({
					name: `${org.name} (${org.org_id})`,
					value: org
				}))
			});
			org = selected;
		} else if (account.orgs.length === 1) {
			// the list of orgs takes precendence over the org
			org = account.orgs[0];
		}

		if (account.org && org && account.org.org_id !== org.org_id) {
			// need to switch org
			org = account.org = await client.switchOrg({
				accessToken: account.tokens.access_token,
				orgId:       org.org_id
			});
		} else {
			org = account.org;
		}

		config.set('auth.defaultOrg', org.org_id);
		await config.save(config.userConfigFile);

		if (argv.json) {
			console.log(JSON.stringify(account, null, '  '));
			return;
		}

		if (org) {
			console.log(`Default account set to ${account.user.email || account.name} in ${org.name}.`);
		} else {
			console.log(`Default account set to ${account.user.email || account.name}.`);
		}
	}
};
