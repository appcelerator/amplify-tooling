export default {
	desc: 'log in to the Axway AMPLIFY platform',
	options: {
		'--force':                   're-authenticate even if the account is already authenticated',
		'--json':                    'outputs accounts as JSON',
		'--no-launch-browser':       'display the authentication URL instead of opening it in the default web browser',
		'--org <id|name>':           'the organization to use',
		'-c, --client-secret <key>': 'a secret key used to authenticate',
		'-s, --secret-file <path>':  'path to the PEM key used to authenticate',
		'-u, --username <user>':     'username to authenticate with',
		'-p, --password <pass>':     'password to authenticate with'
	},
	async action({ argv, console }) {
		const [ { auth }, inquirer ] = await Promise.all([
			import('@axway/amplify-cli-utils'),
			import('inquirer')
		]);

		// prompt for the username and password
		if (argv.hasOwnProperty('username')) {
			const questions = [];

			if (!argv.username) {
				questions.push({
					type: 'input',
					name: 'username',
					message: 'Username:',
					validate(s) {
						return s ? true : 'Please enter your username';
					}
				});
			}

			if (!argv.password) {
				questions.push({
					type: 'password',
					name: 'password',
					message: 'Password:',
					validate(s) {
						return s ? true : 'Please enter your password';
					}
				});
			}

			if (questions.length && argv.json) {
				console.error(JSON.stringify({ error: '--username and --password are required when --json is set' }, null, '  '));
				process.exit(1);
			}

			Object.assign(argv, await inquirer.prompt(questions));
			console.log();
		}

		const { account: acct, client, config } = await auth.getAccount({
			baseUrl:      argv.baseUrl,
			clientId:     argv.clientId,
			clientSecret: argv.secret,
			env:          argv.env,
			password:     argv.password,
			realm:        argv.realm,
			secretFile:   argv.secretFile,
			username:     argv.username
		});
		const manual = !argv.launchBrowser;
		const current = config.get('auth.defaultAccount');
		let account;

		// exit early if we are already authenticated
		if (!argv.force && acct && !acct.expired) {
			if (argv.json) {
				acct.active = current === acct.name;
				console.log(JSON.stringify(acct, null, '  '));
			} else {
				console.log('Account already authenticated.');
			}
			return;
		} else {
			// perform the login
			let { account: acct, cancel, promise, url } = await client.login({ manual });

			// show the url and wait for the user to open it
			if (manual) {
				promise.catch(err => {
					console.error(err.toString());
					process.exit(1);
				});

				process.on('SIGINT', () => cancel());

				console.log(`Please open following link in your browser:\n\n  ${url}\n`);
				account = (await promise).account;
			} else {
				account = acct;
			}
		}

		// determine if the account is active
		const accounts = await client.list();
		if (accounts.length === 1) {
			config.set('auth.defaultAccount', account.name);
			await config.save(config.userConfigFile);
			account.active = true;
		} else if (config.get('auth.defaultAccount') === account.name) {
			account.active = true;
		} else {
			account.active = false;
		}

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
					const error = `Unable to find organization: ${argv.org}`;
					if (argv.json) {
						console.log(JSON.stringify({ error }, null, '  '));
					} else {
						console.error(`${error}\n${account.name} organizations:\n${account.orgs.map(a => `  ${a.name}`).join('\n')}`);
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
			return;
		}

		if (org) {
			console.log(`You are logged into ${org.name} as ${account.user.email || account.name}.\n`);
		} else {
			console.log(`You are logged as ${account.user.email || account.name}.\n`);
		}

		// set the current
		if (accounts.length === 1) {
			console.log('This account has been set as active.');
		} else if (account.active) {
			console.log('This account is active.');
		} else {
			console.log('To make this account active, run:');
			console.log('```bash');
			console.log(`amplify config set auth.defaultAccount ${account.name}`);
			console.log('```');
		}
	}
};
