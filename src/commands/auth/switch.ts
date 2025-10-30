import Command from '../../lib/command.js';
import { highlight, note } from '../../lib/logger.js';
import { getAuthConfigEnvSpecifier, initSDK } from '../../lib/utils.js';
import { renderAccountInfo } from '../../lib/auth/info.js';
import { select } from '@inquirer/prompts';
import { Flags } from '@oclif/core';

export default class AuthSwitch extends Command {
	static override summary = 'Select default account and team.';

	static override description = `Once authenticated, the "switch" command allows you to change the default
account and current team to use for "<%= config.bin %>" commands.

Changing the current team will only affect your local machine and does not
change the actual default team.

The --team option is required when --json flag is set and there is more
than one team.`;

	static override enableJsonFlag = true;

	static override flags = {
		account: Flags.string({
			description: 'The account to switch to',
		}),
		team: Flags.string({
			description: 'The team to use for the selected account',
		}),
	};

	async run(): Promise<any> {
		const { config, flags } = await this.parse(AuthSwitch);
		const sdk = await initSDK();
		const authConfigEnvSpecifier = getAuthConfigEnvSpecifier(sdk.env.name);
		const accounts = await sdk.auth.list({ validate: true, sanitize: false });
		let account;

		if (!accounts.length) {
			throw new Error('No authenticated accounts found');
		}

		if (accounts.length > 1 && !flags.account && this.jsonEnabled()) {
			throw new Error('Must specify --account when --json is set and there are multiple authenticated accounts');
		}

		if (flags.org) {
			throw new Error('Service account\'s are only associated to a single organization. To access a different org, please authenticate using a service account in that organization');
		}

		if (flags.account) {
			account = await sdk.auth.find(flags.account);
			if (!account) {
				const err = new Error(`Account "${flags.account}" not found`) as any;
				err.code = 'ERR_NOT_FOUND';
				err.details = `Authenticated accounts:\n${accounts.map(a => `  ${highlight(a.name)}`).join('\n')}`;
				throw err;
			}
		} else {
			let accountName = accounts[0]?.name;

			if (accounts.length > 1 && !this.jsonEnabled()) {
				const defaultAccount = config.get(`${authConfigEnvSpecifier}.defaultAccount`);
				const choices = accounts
					.map(acct => ({ value: acct.name }))
					.sort((a, b) => a.value.localeCompare(b.value));
				const initial = choices.findIndex(a => a.value === defaultAccount);

				accountName = await select({
					message: 'Please choose an account',
					default: initial >= 0 ? choices[initial].value : undefined,
					choices: choices.map(c => ({ name: c.value, value: c.value }))
				});

				this.log();
			}

			if (accountName) {
				account = await sdk.auth.find(accountName, undefined, false);
			}
		}

		account.default = true;
		config.set(`${authConfigEnvSpecifier}.defaultAccount`, account.name);
		config.delete(`${authConfigEnvSpecifier}.defaultOrg.${account.hash}`);
		config.delete(`${authConfigEnvSpecifier}.defaultTeam.${account.hash}`);
		config.save();

		if (account.org?.teams) {
			const defaultTeam = account?.hash && config.get(`${authConfigEnvSpecifier}.defaultTeam.${account.hash}`);
			const selectedTeam = String(flags.team || defaultTeam || '');
			let team = selectedTeam && account.org.teams.find(t => t.guid.toLowerCase() === selectedTeam.toLowerCase() || t.name.toLowerCase() === selectedTeam.toLowerCase());

			if (!team) {
				if (flags.team) {
					const err = `Unable to find team "${flags.team}"` as any;
					err.code = 'ERR_NOT_FOUND';
					err.details = `Available teams:\n${account.org.teams.map(t => `  ${highlight(t.name)} ${note(`(${t.guid})`)}`).join('\n')}`;
					throw err;
				}

				if (account.org.teams.length === 1) {
					team = account.org.teams[0];
				} else if (account.org.teams.length > 1) {
					if (this.jsonEnabled()) {
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

					this.log();
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
			config.set(`${authConfigEnvSpecifier}.defaultOrg.${account.hash}`, account.org.guid);
		}
		if (account.team) {
			config.set(`${authConfigEnvSpecifier}.defaultTeam.${account.hash}`, account.team.guid);
		}
		if (account.org || account.team) {
			config.save();
		}

		await this.config.runHook('axway:auth:switch', { account });

		if (this.jsonEnabled()) {
			return account;
		} else {
			this.log(`Default account set to ${highlight(account.name)}`);
			this.log(await renderAccountInfo(account, config, sdk));
		}
	}
}
