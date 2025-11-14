import { highlight, note } from '../../../lib/logger.js';
import { Args } from '@oclif/core';
import Command from '../../../lib/command.js';

export default class OrgUserRemove extends Command {
	static override aliases = [
		'org:user:rm'
	];

	static override summary = 'Remove a user from an organization.';

	static override description = 'You can specify the organization by name, id, or guid, and the user by guid or email address.';

	static override args = {
		org: Args.string({
			description: 'The organization name, id, or guid; defaults to the current org.',
			required: false
		}),
		user: Args.string({
			description: 'The user guid or email address',
			required: true
		})
	};

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { args, account, org, sdk } = await this.parse(OrgUserRemove);

		const { user } = await sdk.org.user.remove(account, org, args.user);
		const results = {
			account: account.name,
			org,
			user
		};

		if (this.jsonEnabled()) {
			return results;
		}

		const name = `${results.user.firstname} ${results.user.lastname}`.trim();
		this.log(`Account:      ${highlight(account.name)}`);
		this.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
		this.log(`Successfully removed user "${highlight(name)}" from organization`);
	}
}
