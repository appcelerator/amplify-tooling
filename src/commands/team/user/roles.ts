import { createTable } from '../../../lib/formatter.js';
import { highlight, note } from '../../../lib/logger.js';
import { Flags } from '@oclif/core';
import Command from '../../../lib/command.js';

export default class TeamUserRoles extends Command {
	static override aliases = [
		'team:users:roles'
	];

	static override summary = 'View available team user roles.';

	static override description = 'Roles may vary by organization.';

	static override flags = {
		org: Flags.string({
			description: 'The organization name, id, or guid; defaults to the current org.',
			required: false
		})
	};

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { account, org, sdk } = await this.parse(TeamUserRoles);
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
