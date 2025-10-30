import { initPlatformAccount } from '../../../lib/utils.js';
import { createTable } from '../../../lib/formatter.js';
import { highlight, note } from '../../../lib/logger.js';
import { Args, Flags } from '@oclif/core';
import Command from '../../../lib/command.js';

export default class TeamUserRoles extends Command {
	static override aliases = [
		'team:users:roles',
		'team:member:roles',
		'team:members:roles'
	];

	static override summary = 'View available team user roles.';

	static override description = 'Roles may vary by organization.';

	static override args = {
		account: Args.string({
			description: 'The platform account to use',
			required: false,
		}),
		org: Args.string({
			description: 'The organization name, id, or guid; roles vary by org',
			required: false,
		}),
	};

	static override flags = {
		env: Flags.string({
			description: 'Environment to use',
		}),
	};

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { args, flags } = await this.parse(TeamUserRoles);
		const { account, org, sdk } = await initPlatformAccount(args.account, args.org, flags.env);
		const roles = await sdk.role.list(account, { default: true, org, team: true });

		if (this.jsonEnabled()) {
			return {
				account: account.name,
				org,
				roles
			};
		}

		const table = createTable([ '  Role', 'Description' ]);
		for (const role of roles) {
			table.push([ `  ${highlight(role.id)}`, role.name ]);
		}

		this.log(`Account:      ${highlight(account.name)}`);
		this.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
		this.log('TEAM ROLES');
		this.log(table.toString());
	}
}
