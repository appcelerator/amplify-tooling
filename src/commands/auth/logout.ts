import { highlight } from '../../lib/logger.js';
import { Args } from '@oclif/core';
import Command from '../../lib/command.js';
import { initSDK } from '../../lib/amplify-sdk/index.js';

export default class AuthLogout extends Command {
	static override summary = 'Log out all or specific accounts.';

	static override description = 'Optionally outputs revoked accounts as JSON.';

	static override aliases = [ 'auth:revoke' ];

	static override args = {
		accounts: Args.string({
			description: 'One or more specific accounts to revoke credentials.',
			required: false,
			multiple: true
		})
	};
	static override authenticated = false;

	static override enableJsonFlag = true;

	async run() {
		const { args, config } = await this.parse(AuthLogout);
		const sdk = await initSDK({}, config);

		const accounts = args.accounts ?? [];
		const all = accounts.length === 0;

		const revoked = await sdk.auth.logout({ accounts, all });

		if (this.jsonEnabled()) {
			return revoked;
		}

		// pretty output
		if (revoked.length) {
			this.log('Revoked authenticated accounts:');
			for (const account of revoked) {
				this.log(` ${highlight(account.name)}`);
			}
		} else if (Array.isArray(accounts) && accounts.length === 1) {
			this.error(`No account "${accounts[0]}" found`);
		} else {
			this.error('No authenticated accounts found');
		}
	}
}
