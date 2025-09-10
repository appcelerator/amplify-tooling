import snooplogg from 'snooplogg';
import { getAuthConfigEnvSpecifier, initSDK, isHeadless } from '../../lib/utils.js';
import { renderAccountInfo } from '../../lib/auth/info.js';
import pkg from 'enquirer';

const { prompt } = pkg;

export default {
	desc: 'Select default account, organization, and team',
	help: `Once authenticated, the "switch" command allows you to change the default
account, organization, and current team to use for "axway" commands.

Only platform accounts have organizations. If the selected account is a service
account, then the organization selection is skipped.

Changing the current team will only affect your local machine and does not
change the actual default team.

The --org and --team options are required when --json flag is set and there are
more than one of org or team.`,
	options: {
		'--account [name]':     'The account to switch to',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Disables prompting and outputs selected account and org as JSON'
		},
		'--org [guid|id|name]': 'The platform organization to switch to',
		'--team [guid|name]': 'The team to use for the selected account'
	},
	async action({ argv, cli, console }) {
		const { highlight, note } = snooplogg.styles;
		const { config, sdk } = await initSDK({
			baseUrl:  argv.baseUrl,
			env:      argv.env,
			realm:    argv.realm
		});
		const authConfigEnvSpecifier = getAuthConfigEnvSpecifier(sdk.env.name);
		const accounts = await sdk.auth.list({ validate: true });
		let account;

		if (!accounts.length) {
			throw new Error('No authenticated accounts found');
		}

		if (accounts.length > 1 && !argv.account && argv.json) {
			throw new Error('Must specify --account when --json is set and there are multiple authenticated accounts');
		}

		if (!argv.org && argv.json) {
			throw new Error('Must specify --org when --json is set');
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

				({ accountName } = await prompt({
					choices,
					initial,
					message: 'Please choose an account',
					name:    'accountName',
					type:    'select'
				}));

				console.log();
			}

			if (accountName) {
				account = await sdk.auth.find(accountName);
			}
		}

		account.default = true;
		await config.set(`${authConfigEnvSpecifier}.defaultAccount`, account.name);
		await config.delete(`${authConfigEnvSpecifier}.defaultOrg.${account.hash}`);
		await config.delete(`${authConfigEnvSpecifier}.defaultTeam.${account.hash}`);
		await config.save();

		if (account.isPlatformTooling) {
			const org = argv.org && String(argv.org);
			const o = account.org;
			if (org
				&& org.toLowerCase() !== o.guid?.toLowerCase()
				&& org !== String(o.id)
				&& (!o.name || org.toLowerCase() !== o.name.toLowerCase())) {
				throw new Error(`Specified organization "${org}" does not match the service account's organization (${o.guid || o.id})`);
			}
		}

		if (account.isPlatform) {
			// determine the org
			const defaultOrg = account?.hash && await config.get(`${authConfigEnvSpecifier}.defaultOrg.${account.hash}`);
			const selectedOrg = argv.org || defaultOrg;
			const org = selectedOrg && account.orgs.find(o => String(o.guid) === String(selectedOrg)
						|| String(o.id) === String(selectedOrg) || o.name.toLowerCase() === String(selectedOrg).toLowerCase());
			if (account.isPlatformTooling) {
				if (argv.org && !org) {
					// if there was an explicit --org or default org that wasn't found, then we error for tooling users as web doesn't care
					const err = new Error(`Unable to find organization "${argv.org}"`) as any;
					err.code = 'ERR_NOT_FOUND';
					err.details = `Available organizations:\n${account.orgs.map(a => `  ${highlight(a.name)}`).join('\n')}`;
					throw err;
				}
			} else {
				account = await sdk.auth.switchOrg(account, org?.id, {
					onOpenBrowser() {
						if (isHeadless()) {
							throw new Error('Switching default account and organization requires a web browser and is unsupported in headless environments');
						} else if (!argv.json) {
							console.log('Launching web browser to switch organization...');
						}
					}
				});
			}
		}

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

					team = (await prompt({
						choices,
						format: function () {
							// for some reason, enquirer doesn't print the selected value using the primary
							// (green) color for select prompts, so we just force it for all prompts
							return this.style(this.value);
						},
						initial,
						message: 'Select an team to use',
						name: 'team',
						styles: {
							em(msg) {
								// stylize emphasised text with just the primary color, no underline
								return this.primary(msg);
							}
						},
						type: 'select'
					} as any) as any).team;

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
		} else if (account.isPlatform && account.org?.name) {
			console.log(`Default account set to ${highlight(account.user.email || account.name)} in ${highlight(account.org.name)} ${note(`(${account.org.guid})`)}`);
		} else {
			console.log(`Default account set to ${highlight(account.user.email || account.name)}`);
		}

		console.log(await renderAccountInfo(account, config, sdk));
	}
};
