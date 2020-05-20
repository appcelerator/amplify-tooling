export default {
	desc: 'Select default account and organization',
	options: {
		'--account [name]':     'The account to switch to',
		'--json':               'Outputs accounts as JSON',
		'--org [guid|id|name]': 'The organization to switch to'
	},
	async action({ argv, console }) {
		const [
			{ initSDK },
			{ ansi },
			inquirer,
			{ default: snooplogg }
		] = await Promise.all([
			import('@axway/amplify-cli-utils'),
			import('cli-kit'),
			import('inquirer'),
			import('snooplogg')
		]);

		const { alert, highlight } = snooplogg.styles;
		const { config, sdk } = initSDK();
		const accounts = await sdk.auth.list();

		try {
			if (!accounts.length) {
				const err = new Error('No authenticated accounts found');
				err.code = 'ERR_NO_ACCOUNTS';
				err.details = `Please login first:\n  ${highlight('amplify auth login')}`;
				throw err;
			}

			if (accounts.length > 1 && !argv.account && argv.json) {
				throw new Error('Must specify --account when --json is set and there are multiple authenticated accounts');
			}

			let account;

			if (argv.account) {
				account = await sdk.auth.find(argv.account);
				if (!account) {
					const err = new Error(`Account "${argv.account}" not found`);
					err.code = 'ERR_NOT_FOUND';
					err.details = `Authenticated accounts:\n${accounts.map(a => `  ${highlight(a.name)}`).join('\n')}`;
					throw err;
				}
			} else if (accounts.length === 1) {
				account = accounts[0];
			} else if (!argv.json) {
				account = (await inquirer.prompt({
					type: 'list',
					name: 'selected',
					message: 'Please choose an account:',
					default: config.get('auth.defaultAccount'),
					choices: accounts.map(acct => ({
						name: acct.name,
						value: acct
					}))
				})).selected;
				console.log();
			}

			config.set('auth.defaultAccount', account.name);
			config.save();
			account.default = true;

			// determine the org
			let org;

			if (argv.org) {
				for (const o of account.orgs) {
					if (o.guid === argv.org || o.id === argv.org || o.name === argv.org) {
						org = o;
						break;
					}
				}

				if (!org) {
					const err = `Unable to find organization "${argv.org}"`;
					err.code = 'ERR_NOT_FOUND';
					err.details = `Available organizations:\n${account.orgs.map(a => `  ${highlight(a.name)}`).join('\n')}`;
					throw err;
				}
			} else if (account.orgs.length === 1) {
				// the list of orgs takes precendence over the org
				org = account.orgs[0];
			} else if (argv.json) {
				throw new Error('Must specify --org when --json is set and the selected account has multiple organizations');
			} else if (account.orgs.length > 1) {
				let defaultOrg = config.get(`auth.defaultOrg.${account.hash}`);
				if (defaultOrg) {
					defaultOrg = account.orgs.find(o => o.guid === defaultOrg);
				}

				org = (await inquirer.prompt({
					type: 'list',
					name: 'selected',
					message: 'Please choose an organization:',
					default: defaultOrg,
					choices: account.orgs.map(org => ({
						name: `${org.name} (${org.id})`,
						value: org
					}))
				})).selected;

				console.log();
			}

			if (!account.org || account.org !== org) {
				// need to switch org
				account = await sdk.auth.switchOrg(account, org.id);
			}

			if (org) {
				config.set(`auth.defaultOrg.${account.hash}`, org.guid);
				config.save();
			}

			if (argv.json) {
				console.log(JSON.stringify(account, null, 2));
			} else if (org) {
				console.log(`Default account set to ${highlight(account.user.email || account.name)} in ${highlight(org.name)}`);
			} else {
				console.log(`Default account set to ${highlight(account.user.email || account.name)}`);
			}
		} catch (err) {
			if (argv.json) {
				console.error(JSON.stringify({
					error: err.toString(),
					code: err.code,
					details: err.details && ansi.strip(err.details),
					accounts: accounts.map(a => a.name)
				}, null, 2));
			} else {
				console.error(alert(err.toString()));
				if (err.details) {
					console.error(`\n${err.details}`);
				}
			}
			process.exit(err.exitCode || 1);
		}
	}
};
