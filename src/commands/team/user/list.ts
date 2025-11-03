import { initPlatformAccount } from '../../../lib/utils.js';
import { createTable } from '../../../lib/formatter.js';
import { highlight, note } from '../../../lib/logger.js';
import { Args, Flags } from '@oclif/core';
import Command from '../../../lib/command.js';

export default class TeamUserList extends Command {
	static override aliases = [
		'team:user:ls',
		'team:users:ls',
		'team:users:list',
		'team:member:ls',
		'team:member:list',
		'team:members:ls',
		'team:members:list'
	];

	static override summary = 'List users in a team.';

	static override description = 'The organization can be specified by name, id, or guid. The team can be specified by name or guid.';

	static override args = {
		org: Args.string({
			description: 'The organization name, id, or guid',
			required: true,
		}),
		team: Args.string({
			description: 'The team name or guid',
			required: true,
		}),
	};

	static override flags = {
		account: Flags.string({
			description: 'The platform account to use',
		}),
	};

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { args, flags } = await this.parse(TeamUserList);
		const { account, org, sdk } = await initPlatformAccount(flags.account, args.org);
		const { team } = await sdk.team.find(account, org, args.team);

		if (!team) {
			throw new Error(`Unable to find team "${args.team}"`);
		}

		const { users } = await sdk.team.user.list(account, org, team.guid);

		if (this.jsonEnabled()) {
			return {
				account: account.name,
				org,
				team,
				users,
			};
		}

		this.log(`Account:      ${highlight(account.name)}`);
		this.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}`);
		this.log(`Team:         ${highlight(team.name)} ${note(`(${team.guid})`)}\n`);

		if (!users.length) {
			this.log('No users found');
			return;
		}

		const table = createTable([ 'Name', 'Type', 'Email', 'GUID', 'Teams', 'Roles' ]);

		for (const { email, guid, name, roles, teams, type } of users) {
			table.push([
				name,
				type === 'client' ? 'Service' : type === 'user' ? 'User' : type,
				email,
				guid,
				teams,
				roles.length ? roles.join(', ') : note('n/a')
			]);
		}
		this.log(table.toString());
	}
};
