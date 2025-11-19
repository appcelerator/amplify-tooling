import { highlight, note } from '../../../lib/logger.js';
import { Args, Flags } from '@oclif/core';
import Command from '../../../lib/command.js';

export default class OrgUserUpdate extends Command {
	static override summary = 'Update a user\'s organization roles.';

	static override description = 'You must have administrative access to update an organization\'s user roles.';

	static override args = {
		org: Args.string({
			description: 'The organization name, id, or guid; defaults to the current org.',
			required: false
		}),
		user: Args.string({
			description: 'The user guid or email address.',
			required: true
		})
	};

	static override flags = {
		role: Flags.string({
			description: 'Assign one or more organization roles to a user.',
			multiple: true
		})
	};

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { args, flags, account, org, sdk } = await this.parse(OrgUserUpdate);

		if (!account.user.roles.includes('administrator')) {
			throw new Error('You do not have administrative access to update an organization\'s user roles');
		}

		const { roles, user } = await sdk.org.user.update(account, org, args.user, flags.role);

		const results = {
			account: account.name,
			org,
			user
		};

		if (this.jsonEnabled()) {
			return results;
		} else {
			const name = `${user.firstname} ${user.lastname}`.trim();
			this.log(`Account:      ${highlight(account.name)}`);
			this.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
			this.log(`Successfully updated role${roles.length === 1 ? '' : 's'} for ${highlight(name)}`);
		}
	}
}
