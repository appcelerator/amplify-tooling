export default {
	desc: 'Select default account and organization',
	options: {
		'--account [name]':     'The account to switch to',
		'--json':               'Outputs selected account as JSON',
		'--org [guid|id|name]': 'The organization to switch to'
	},
	async action({ argv, console }) {
		const { ansi } = require('cli-kit');
		const { default: snooplogg } = require('snooplogg');
		const { initSDK } = require('@axway/amplify-cli-utils');
		const { prompt } = require('enquirer');
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
				const defaultAccount = config.get('auth.defaultAccount');
				const choices = accounts
					.map(acct => ({
						name:    acct.name,
						message: acct.name,
						value:   acct
					}))
					.sort((a, b) => a.message.localeCompare(b.message));
				const initial = choices.findIndex(a => a.name === defaultAccount);

				({ account } = await prompt({
					choices,
					initial,
					message: 'Please choose an account',
					name:    'account',
					type:    'select'
				}));

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
				const defaultOrg = config.get(`auth.defaultOrg.${account.hash}`);
				const choices = account.orgs
					.map(org => {
						org.toString = () => org.name;
						return {
							guid:    org.guid,
							message: `${org.name} (${org.guid} : ${org.id})`,
							value:   org
						};
					})
					.sort((a, b) => a.message.localeCompare(b.message));
				const initial = choices.findIndex(org => org.guid === defaultOrg);

				({ org } = await prompt({
					choices,
					format: function () {
						// for some reason, enquirer doesn't print the selected value using the primary
						// (green) color for select prompts, so we just force it for all prompts
						return this.style(this.value);
					},
					initial,
					message: 'Select an organization to switch to',
					name:    'org',
					styles: {
						em(msg) {
							// stylize emphasised text with just the primary color, no underline
							return this.primary(msg);
						}
					},
					type:    'select'
				}));

				console.log();
			}

			if (!account.org || account.org !== org) {
				// need to switch org
				if (!argv.json) {
					console.log('Launching web browser to switch organization...');
				}
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
			} else if (err.details) {
				console.error(`${alert(err.toString())}\n\n${err.details}`);
			} else {
				console.error(alert(err));
			}
			process.exit(err.exitCode || 1);
		}
	}
};
