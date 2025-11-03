import { initPlatformAccount } from '../../lib/utils.js';
import { highlight } from '../../lib/logger.js';
import { Args, Flags } from '@oclif/core';
import Command from '../../lib/command.js';

export default class OrgRename extends Command {
	static override summary = 'Rename an organization.';
	static override description = `Renames an organization by specifying its name, id, or guid and the new name.
You must have administrative access to perform this action.`;

	static override args = {
		org: Args.string({
			description: 'The organization name, id, or guid; defaults to the current org',
			required: true
		}),
		name: Args.string({
			description: 'The new organization name',
			required: true
		})
	};

	static override flags = {
		account: Flags.string({
			description: 'The platform account to use'
		})
	};

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { args, flags } = await this.parse(OrgRename);
		const { account, org, sdk } = await initPlatformAccount(flags.account, args.org);

		if (!account.user.roles.includes('administrator')) {
			throw new Error('You do not have administrative access to rename the organization');
		}

		const result = await sdk.org.rename(account, org, args.name);

		if (this.jsonEnabled()) {
			return {
				account: account.name,
				...result
			};
		} else {
			this.log(`Account: ${highlight(account.name)}\n`);
			this.log(`Successfully renamed "${result.oldName}" to "${result.name}"`);
		}
	}
}
