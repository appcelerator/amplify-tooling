import { highlight, note } from '../../../lib/logger.js';
import { Args, Flags } from '@oclif/core';
import Command from '../../../lib/command.js';

export default class TeamUserAdd extends Command {
	static override aliases = [
		'team:users:add'
	];

	static override summary = 'Add a user or service account to a team.';

	static override description = `The user or service account must already be registered on the platform.

A team user must be assigned a platform role and optionally a product specific role. You may specify the roles with multiple --role "role" options or a single --role "role1,role2,role3" option with a comma-separated list of roles.

To view available team user roles, run: ${highlight(`"<%= config.bin %> team user roles"`)}`;

	static override args = {
		team: Args.string({
			description: 'The team name or guid',
			required: true
		}),
		user: Args.string({
			description: 'The user guid or email address or service account guid or client id',
			required: true
		})
	};

	static override flags = {
		role: Flags.string({
			description: 'Assign one or more team roles to a user',
			multiple: true
		})
	};

	static override examples = [
		{
			description: 'Add a user to a team with administrator privileges.',
			command: '<%= config.bin %> <%= command.id %> <team> <email> --role administrator'
		},
		{
			description: 'Add a service account to a team with administrator privileges.',
			command: '<%= config.bin %> <%= command.id %> <team> <client_id> --role administrator'
		}
	];

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { args, flags, account, org, sdk } = await this.parse(TeamUserAdd);

		if (!account.user.roles.includes('administrator')) {
			throw new Error(`You do not have administrative access to add a user to a team in the "${org.name}" organization`);
		}

		const { team, user } = await sdk.team.user.add(account, org, args.team, args.user, flags.role);

		const results = {
			account: account.name,
			org,
			team,
			user
		};

		if (this.jsonEnabled()) {
			return results;
		} else {
			this.log(`Account:      ${highlight(account.name)}`);
			this.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

			if (user.client_id) {
				this.log(`Successfully added service account ${highlight(user.name)} to the ${highlight(team.name)} team`);
			} else {
				const name = `${user.firstname} ${user.lastname}`.trim();
				this.log(`Successfully added user ${highlight(name)} to the ${highlight(team.name)} team`);
			}
		}
	}
}
