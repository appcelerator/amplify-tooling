import { initPlatformAccount } from '../../../lib/utils.js';
import { highlight, note } from '../../../lib/logger.js';
import { Args, Flags } from '@oclif/core';
import Command from '../../../lib/command.js';

export default class OrgUserAdd extends Command {
	static override summary = 'Adds or invites a user to an organization.';

	static override description = `You may specify an organization by name, id, or guid.

If the user is not already a platform user, they will automatically be
invited to create a platform account and join the organization.

An organization user must be assigned a platform role and optionally a
product specific role. You may specify the roles with multiple ${highlight('--role "role"')}
options or a single ${highlight('--role "role1,role2,role3"')} option with a comma-separated
list of roles. To view available user roles, run: ${highlight('<%= config.bin %> org user roles')}`;

	static override args = {
		org: Args.string({
			description: 'The organization name, id, or guid',
			required: true
		}),
		email: Args.string({
			description: 'The email address for the user to add',
			required: true
		})
	};

	static override flags = {
		account: Flags.string({
			description: 'The platform account to use'
		}),
		role: Flags.string({
			description: 'Assign one or more organization roles to a user',
			multiple: true,
			required: true
		})
	};

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { args, flags } = await this.parse(OrgUserAdd);
		const { account, org, sdk } = await initPlatformAccount(flags.account, args.org);

		if (!account.user.roles.includes('administrator')) {
			throw new Error('You do not have administrative access to add users to the organization');
		}

		if (!this.jsonEnabled()) {
			this.log(`Account:      ${highlight(account.name)}`);
			this.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
		}

		const { user } = await sdk.org.user.add(account, org, args.email, flags.role);
		const results = {
			account: account.name,
			org,
			user
		};

		if (this.jsonEnabled()) {
			return results;
		}

		const name = `${results.user.firstname} ${results.user.lastname}`.trim();
		this.log(`Successfully added ${highlight(name)} to ${highlight(org.name)}`);
	}
}
