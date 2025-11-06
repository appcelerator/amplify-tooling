import Command from '../../lib/command.js';
import { Args } from '@oclif/core';
import { initSDK } from '../../lib/utils.js';
import { renderAccountInfo } from '../../lib/auth/info.js';
import { highlight } from '../../lib/logger.js';

export default class AuthWhoami extends Command {
	static override description = 'Display info for an authenticated account';

	static override args = {
		accountName: Args.string({ description: 'The account to display', required: false }),
	};

	static override enableJsonFlag = true;

	async run() {
		const { args, config } = await this.parse(AuthWhoami);
		const sdk = await initSDK();
		let accounts = await sdk.auth.list({
			defaultTeams: config.get('auth.defaultTeam'),
			validate: true
		});
		for (const account of accounts) {
			account.default = account.name === config.get('auth.defaultAccount');
		}

		if (args.accountName) {
			const re = new RegExp(`${args.accountName}`, 'i');
			accounts = accounts.filter(a => re.test(a.name) || re.test(a.user.email) || re.test(a.org.name));
		}

		if (this.jsonEnabled()) {
			return accounts;
		} else if (accounts.length) {
			let account = accounts.find(a => a.default);
			if (!account) {
				account = accounts[0];
			}

			this.log(`You are authenticated using the ${highlight(account.name)} service account.`);
			this.log(await renderAccountInfo(account, config, sdk));
		} else if (args.accountName) {
			this.log(`The account ${highlight(args.accountName)} is not logged in.`);
		} else {
			this.log('You are not logged in.');
		}
	}
}
