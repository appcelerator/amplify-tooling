import { highlight, note } from '../../lib/logger.js';
import { getAuthConfigEnvSpecifier, initSDK } from '../../lib/utils.js';
import { renderAccountInfo } from '../../lib/auth/info.js';
import { select } from '@inquirer/prompts';

export default {
	desc: 'Select default account and team',
	help: `Once authenticated, the "switch" command allows you to change the default
account and current team to use for "axway" commands.

Changing the current team will only affect your local machine and does not
change the actual default team.

The --team option is required when --json flag is set and there is more
than one team.`,
	options: {
		'--account [name]':     'The account to switch to',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Disables prompting and outputs selected account and org as JSON'
		},
		'--team [guid|name]': 'The team to use for the selected account'
	},
	async action({ argv, cli, console }) {
		const { config, sdk } = await initSDK({
			baseUrl:  argv.baseUrl,
			env:      argv.env,
			realm:    argv.realm
		});
		const authConfigEnvSpecifier = getAuthConfigEnvSpecifier(sdk.env.name);
		// Fetch all accounts, including any stored credentials.
		// This ensure the `updateAccount` call later does not remove them from the store.
		const accounts = await sdk.auth.list({ validate: true, sanitize: false });
		let account;

		if (!accounts.length) {
			throw new Error('No authenticated accounts found');
		}

		if (accounts.length > 1 && !argv.account && argv.json) {
			throw new Error('Must specify --account when --json is set and there are multiple authenticated accounts');
		}

		// Log if the deprecated org param is used
		if (argv.org) {
			throw new Error('Service account\'s are only associated to a single organization. To access a different org, please authenticate using a service account in that organization');
		}

		if (argv.account) {
			account = await sdk.auth.find(argv.account);
			if (!account) {
				const err = new Error(`Account "${argv.account}" not found`) as any;
				err.code = 'ERR_NOT_FOUND';
				err.details = `Authenticated accounts:\n${accounts.map(a => `  ${highlight(a.name)}`).join('\n')}`;
				throw err;
			}
		} else {
			// pick account from the list of of authenticated accounts
			let accountName = accounts[0]?.name;

			if (accounts.length > 1 && !argv.json) {
				// we have more than one authenticated account, so we must prompt for which account
				const defaultAccount = await config.get(`${authConfigEnvSpecifier}.defaultAccount`);
				const choices = accounts
					.map(acct => ({ value: acct.name }))
					.sort((a, b) => a.value.localeCompare(b.value));
				const initial = choices.findIndex(a => a.value === defaultAccount);

				accountName = await select({
					message: 'Please choose an account',
					default: initial >= 0 ? choices[initial].value : undefined,
					choices: choices.map(c => ({ name: c.value, value: c.value }))
				});

				console.log();
			}

			if (accountName) {
				account = await sdk.auth.find(accountName, undefined, false);
			}
		}

		account.default = true;
		await config.set(`${authConfigEnvSpecifier}.defaultAccount`, account.name);
		await config.delete(`${authConfigEnvSpecifier}.defaultOrg.${account.hash}`);
		await config.delete(`${authConfigEnvSpecifier}.defaultTeam.${account.hash}`);
		await config.save();

		if (account.org?.teams) {
			// determine the team
			const defaultTeam = account?.hash && await config.get(`${authConfigEnvSpecifier}.defaultTeam.${account.hash}`);
			const selectedTeam = String(argv.team || defaultTeam || '');
			let team = selectedTeam && account.org.teams.find(t => t.guid.toLowerCase() === selectedTeam.toLowerCase() || t.name.toLowerCase() === selectedTeam.toLowerCase());

			if (!team) {
				if (argv.team) {
					// if there was an explicit --org that wasn't found, then we error for tooling users as web doesn't care
					const err = `Unable to find team "${argv.team}"` as any;
					err.code = 'ERR_NOT_FOUND';
					err.details = `Available teams:\n${account.org.teams.map(t => `  ${highlight(t.name)} ${note(`(${t.guid})`)}`).join('\n')}`;
					throw err;
				}

				if (account.org.teams.length === 1) {
					team = account.org.teams[0];
				} else if (account.org.teams.length > 1) {
					if (argv.json) {
						throw new Error('Must specify --team when --json is set and the selected account has multiple teams');
					}

					const choices = account.org.teams
						.map(team => {
							team.toString = () => team.name;
							return {
								guid:    team.guid,
								message: `${team.name} (${team.guid})`,
								value:   team
							};
						})
						.sort((a, b) => a.message.localeCompare(b.message));
					const initial = choices.findIndex(team => team.guid === defaultTeam);

					team = await select({
						message: 'Select a team to use',
						default: initial >= 0 ? choices[initial].value : undefined,
						choices: choices.map(c => ({ name: c.message, value: c.value }))
					});

					console.log();
				}
			}

			if (team) {
				account.team = {
					default: team.default,
					guid:    team.guid,
					name:    team.name,
					roles:   team.users?.find(u => u.guid === account.user.guid)?.roles || [],
					tags:    team.tags
				};
				await sdk.authClient.updateAccount(account);
			}
		}

		if (account.org) {
			await config.set(`${authConfigEnvSpecifier}.defaultOrg.${account.hash}`, account.org.guid);
		}
		if (account.team) {
			await config.set(`${authConfigEnvSpecifier}.defaultTeam.${account.hash}`, account.team.guid);
		}
		if (account.org || account.team) {
			await config.save();
		}

		await cli.emitAction('axway:auth:switch', account);

		if (argv.json) {
			console.log(JSON.stringify(account, null, 2));
		} else {
			console.log(`Default account set to ${highlight(account.name)}`);
		}

		console.log(await renderAccountInfo(account, config, sdk));
	}
};
