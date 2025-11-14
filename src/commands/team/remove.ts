import { highlight } from '../../lib/logger.js';
import { Args } from '@oclif/core';
import Command from '../../lib/command.js';

export default class TeamRemove extends Command {
	static override aliases = [ 'team:rm' ];

	static override summary = 'Remove a team from an organization.';

	static override description = 'Removes a team from the specified organization. You must have administrative access to perform this action.';

	static override args = {
		org: Args.string({
			description: 'The organization name, id, or guid; defaults to the current org.',
			required: false
		}),
		team: Args.string({
			description: 'The team name or guid.',
			required: true
		})
	};

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { args, account, org, sdk } = await this.parse(TeamRemove);

		if (!account.user.roles.includes('administrator')) {
			throw new Error(`You do not have administrative access to remove a team from the "${org.name}" organization`);
		}

		const { team } = await sdk.team.remove(account, org, args.team);
		const results = {
			account: account.name,
			org,
			team,
		};

		if (this.jsonEnabled()) {
			return results;
		} else {
			this.log(`Account: ${highlight(account.name)}\n`);
			this.log(`Successfully removed team ${highlight(team.name)}`);
		}
	}
}
