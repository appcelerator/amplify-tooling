import { highlight, note } from '../../../lib/logger.js';
import { Args } from '@oclif/core';
import Command from '../../../lib/command.js';

export default class TeamUserRemove extends Command {
	static override aliases = [
		'team:user:rm',
		'team:users:rm',
		'team:users:remove'
	];

	static override summary = 'Remove a user from a team.';

	static override description = 'You must have administrative access to perform this action.';

	static override args = {
		org: Args.string({
			description: 'The organization name, id, or guid; defaults to the current org.',
			required: false
		}),
		team: Args.string({
			description: 'The team name or guid.',
			required: true
		}),
		user: Args.string({
			description: 'The user guid or email address.',
			required: true
		})
	};

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { args, account, org, sdk } = await this.parse(TeamUserRemove);

		if (!account.user.roles.includes('administrator')) {
			throw new Error(`You do not have administrative access to remove a user from a team in the "${org.name}" organization`);
		}

		const { team, user } = await sdk.team.user.remove(account, org, args.team, args.user);

		const results = {
			account: account.name,
			org,
			team,
			user
		};

		if (this.jsonEnabled()) {
			return results;
		}

		this.log(`Account:      ${highlight(account.name)}`);
		this.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		if (user.client_id) {
			this.log(`Successfully removed service account ${highlight(user.name)} from the ${highlight(team.name)} team`);
		} else {
			const name = `${user.firstname} ${user.lastname}`.trim();
			this.log(`Successfully removed user ${highlight(name)} from the ${highlight(team.name)} team`);
		}
	}
}
