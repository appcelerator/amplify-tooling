import { initPlatformAccount } from '../../../lib/utils.js';
import { highlight, note } from '../../../lib/logger.js';
import { Args, Flags } from '@oclif/core';
import Command from '../../../lib/command.js';

export default class TeamUserAdd extends Command {
	static override aliases = [
		'team:users:add',
		'team:member:add',
		'team:members:add'
	];

	static override summary = 'Add a user to a team.';

	static override description = `You may specify an organization by name, id, or guid.

The user must already be a platform user.

A team user must be assigned a platform role and optionally a product specific role. You may specify the roles with multiple --role "role" options or a single --role "role1,role2,role3" option with a comma-separated list of roles. To view available user roles, run: axway team user roles
`;

	static override args = {
		org: Args.string({
			description: 'The organization name, id, or guid',
			required: true
		}),
		team: Args.string({
			description: 'The team name or guid',
			required: true
		}),
		user: Args.string({
			description: 'The user guid or email address',
			required: true
		})
	};

	static override flags = {
		account: Flags.string({
			description: 'The platform account to use'
		}),
		role: Flags.string({
			description: 'Assign one or more team roles to a user',
			multiple: true
		})
	};

	static override examples = [
		{
			description: 'Add a user to an organization with administrator privileges.',
			command: '<%= config.bin %> <%= command.id %> <org> <team> <email> --role administrator'
		}
	];

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { args, flags } = await this.parse(TeamUserAdd);
		const { account, org, sdk } = await initPlatformAccount(flags.account, args.org, flags.env);

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
