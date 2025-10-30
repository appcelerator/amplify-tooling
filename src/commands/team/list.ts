import { initPlatformAccount } from '../../lib/utils.js';
import { createTable } from '../../lib/formatter.js';
import { active, highlight, note } from '../../lib/logger.js';
import { Args, Flags } from '@oclif/core';
import Command from '../../lib/command.js';

export default class TeamList extends Command {
	static override aliases = [
		'team:ls',
	];

	static override summary = 'List organization teams.';

	static override description = 'Lists all teams for an organization.';

	static override enableJsonFlag = true;

	static override args = {
		org: Args.string({
			description: 'The organization name, id, or guid; defaults to the current org',
			required: false
		}),
	};

	static override flags = {
		account: Flags.string({
			description: 'The account to use',
		}),
	};

	async run(): Promise<any | void> {
		const { args, flags } = await this.parse(TeamList);
		const { account, org, sdk } = await initPlatformAccount(flags.account, args.org, flags.env);
		const { teams } = await sdk.team.list(account, org);

		if (this.jsonEnabled()) {
			return {
				account: account.name,
				org,
				teams,
			};
		}

		this.log(`Account:      ${highlight(account.name)}`);
		this.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		if (!teams.length) {
			return this.log('No teams found');
		}

		const table = createTable([ 'Name', 'Description', 'GUID', 'User', 'Apps', 'Date Created' ]);
		const check = process.platform === 'win32' ? '√' : '✔';

		for (const { apps, created, default: def, desc, guid, name, users } of teams) {
			table.push([
				def ? active(`${check} ${name}`) : `  ${name}`,
				desc || note('n/a'),
				guid,
				users.length,
				apps?.length,
				new Date(created).toLocaleDateString()
			]);
		}
		this.log(table.toString());
	}
}
