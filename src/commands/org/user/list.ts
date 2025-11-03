import { initPlatformAccount } from '../../../lib/utils.js';
import { createTable } from '../../../lib/formatter.js';
import { highlight, note } from '../../../lib/logger.js';
import { Args, Flags } from '@oclif/core';
import Command from '../../../lib/command.js';

export default class OrgUserList extends Command {
	static override aliases = [
		'org:user:ls'
	];

	static override summary = 'List users in an organization.';

	static override description = 'The organization can be specified by name, id, or guid; defaults to the current org.';

	static override args = {
		org: Args.string({
			description: 'The organization name, id, or guid; defaults to the current org',
			required: false
		})
	};

	static override flags = {
		account: Flags.string({
			description: 'The platform account to use'
		})
	};

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { args, flags } = await this.parse(OrgUserList);
		const { account, org, sdk } = await initPlatformAccount(flags.account, args.org);
		const { users } = await sdk.org.user.list(account, org);

		if (this.jsonEnabled()) {
			return {
				account: account.name,
				org,
				users
			};
		}

		this.log(`Account:      ${highlight(account.name)}`);
		this.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		if (!users.length) {
			this.log('No users found');
			return;
		}

		const table = createTable([ 'Name', 'Type', 'Email', 'GUID', 'Teams', 'Roles' ]);

		for (const { client_id, email, guid, name, roles, teams } of users) {
			table.push([
				name,
				client_id ? 'Service' : 'User',
				email,
				guid,
				teams,
				roles.length ? roles.join(', ') : note('n/a')
			]);
		}
		this.log(table.toString());
	}
}
