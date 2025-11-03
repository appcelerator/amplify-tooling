import { initPlatformAccount } from '../../../lib/utils.js';
import { createTable } from '../../../lib/formatter.js';
import { highlight, note } from '../../../lib/logger.js';
import { Args, Flags } from '@oclif/core';
import Command from '../../../lib/command.js';

export default class OrgUserRoles extends Command {
	static override summary = 'View available organization user roles.';

	static override description = 'View the available roles for users in an organization. Roles may vary by organization.';

	static override args = {
		org: Args.string({
			description: 'The organization name, id, or guid; roles vary by org',
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
		const { flags, args } = await this.parse(OrgUserRoles);
		const { account, org, sdk } = await initPlatformAccount(flags.account, args.org);
		const roles = await sdk.role.list(account, { org });

		if (this.jsonEnabled()) {
			return {
				account: account.name,
				org,
				roles
			};
		}

		const platformRoles = createTable([ '  Role', 'Description' ]);
		const serviceRoles = createTable([ '  Role', 'Description', 'Product' ]);

		for (const role of roles) {
			if (role.default) {
				platformRoles.push([ `  ${highlight(role.id)}`, role.name ]);
			} else {
				serviceRoles.push([ `  ${highlight(role.id)}`, role.name, role.product || '' ]);
			}
		}

		this.log(`Account:      ${highlight(account.name)}`);
		this.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		this.log('PLATFORM ROLES');
		this.log(platformRoles.toString());

		if (serviceRoles.length) {
			this.log('\nSERVICE ROLES');
			this.log(serviceRoles.toString());
		}
	}
}
