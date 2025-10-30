import { initPlatformAccount } from '../../../lib/utils.js';
import { highlight, note } from '../../../lib/logger.js';
import { Args, Flags } from '@oclif/core';
import Command from '../../../lib/command.js';

export default class OrgUserRemove extends Command {
	static override aliases = [
		'org:user:rm'
	];

	static override summary = 'Remove a user from an organization.';

	static override description = 'You can specify the organization by name, id, or guid, and the user by guid or email address.';

	static override args = {
		org: Args.string({
			description: 'The organization name, id, or guid; defaults to the current org',
			required: true
		}),
		user: Args.string({
			description: 'The user guid or email address',
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
		const { args } = await this.parse(OrgUserRemove);
		const { account, org, sdk } = await initPlatformAccount(args.account, args.org, args.env);

		const { user } = await sdk.org.user.remove(account, org, args.user);
		const results = {
			account: account.name,
			org,
			user
		};

		if (this.jsonEnabled()) {
			return results;
		} else {
			const name = `${results.user.firstname} ${results.user.lastname}`.trim();
			this.log(`Account:      ${highlight(account.name)}`);
			this.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
			this.log(`Successfully removed user "${highlight(name)}" from organization`);
		}
	}
}
