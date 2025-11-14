import { createTable } from '../../lib/formatter.js';
import { highlight, note } from '../../lib/logger.js';
import { Flags } from '@oclif/core';
import Command from '../../lib/command.js';

export default class RolesCommand extends Command {
	static override summary = 'View available service account roles.';

	static override description = 'Organization roles and team roles may vary by organization.';

	static override flags = {
		org: Flags.string({
			description: 'The organization name, id, or guid; defaults to the current org.',
			required: false
		})
	};

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { account, org, sdk } = await this.parse(RolesCommand);
		const orgRoles = await sdk.role.list(account, { org });
		const teamRoles = await sdk.role.list(account, { team: true, org });

		if (this.jsonEnabled()) {
			return {
				account: account.name,
				org,
				orgRoles,
				teamRoles
			};
		}

		this.log(`Account:      ${highlight(account.name)}`);
		this.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		const table = createTable();
		table.push([ { colSpan: 2, content: 'ORGANIZATION ROLES' } ]);
		for (const role of orgRoles) {
			table.push([ `  ${highlight(role.id)}`, role.name ]);
		}
		table.push([ '', '' ]);

		table.push([ { colSpan: 2, content: 'TEAM ROLES' } ]);
		for (const role of teamRoles) {
			table.push([ `  ${highlight(role.id)}`, role.name ]);
		}

		this.log(table.toString());
	}
}
