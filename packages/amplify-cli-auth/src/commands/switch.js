export default {
	desc: 'select default account and organization',
	options: {
		'--account': 'the account to switch to',
		'--json':    'outputs accounts as JSON',
		'--org':     'the organization to switch to'
	},
	async action({ argv, console }) {
		const [ { auth }, inquirer ] = await Promise.all([
			import('@axway/amplify-cli-utils'),
			import('inquirer')
		]);
		const accounts = await auth.list();
		let hash = null;

		if (!accounts.length) {
			const error = 'No credentials found, please login';
			if (argv.json) {
				console.log(JSON.stringify({ error }, null, '  '));
			} else {
				console.error(`${error}:\n\n  amplify auth login`);
			}
			process.exit(1);
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

		config.set('auth.defaultAccount', account.name);
		await config.save(config.userConfigFile);
		account.active = true;

		// deterimine the organization
		let org = null;
		if (account.orgs.length) {
			if (argv.org) {
				for (const o of account.orgs) {
					if (o.org_id === argv.org || o.name === argv.org) {
						org = o;
						break;
					}
				}
				if (!org) {
					const error = `Unable to find organization: ${argv.orgId}`;
					if (argv.json) {
						console.log(JSON.stringify({ error }, null, '  '));
					} else {
						console.error(`${error}\n${account.name} organizations:\n${account.org.map(a => `  ${a.name}`).join('\n')}`);
					}
					process.exit(1);
				}
			} else if (account.orgs.length === 1) {
				// the list of orgs takes precendence over the org
				org = account.orgs[0];
			} else if (argv.json) {
				console.log(JSON.stringify({ error: 'Must specify --org when --json is set and the selected account has multiple organizations' }, null, '  '));
				process.exit(1);
			} else if (account.orgs.length > 1) {
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
				console.log();
			}

			if (account.org && account.org.org_id !== org.org_id) {
				// need to switch org
				org = await client.switchOrg({
					accessToken: account.tokens.access_token,
					account,
					orgId:       org.org_id
				});
			}

			if (org) {
				config.set(`auth.defaultOrg.${account.hash}`, org.org_id);
				await config.save(config.userConfigFile);
			}
		} else if (!argv.json) {
			console.warn('Account has no organizations!\n');
		}

		if (argv.json) {
			console.log(JSON.stringify(account, null, '  '));
		} else if (org) {
			console.log(`Default account set to ${account.user.email || account.name} in ${org.name}.`);
		} else {
			console.log(`Default account set to ${account.user.email || account.name}.`);
		}
	}
};
