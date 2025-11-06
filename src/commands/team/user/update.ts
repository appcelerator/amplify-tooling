import { initPlatformAccount } from '../../../lib/utils.js';
import { highlight, note } from '../../../lib/logger.js';
import { Args, Flags } from '@oclif/core';
import Command from '../../../lib/command.js';

export default class TeamUserUpdate extends Command {
	static override aliases = [
		'team:users:update'
	];

	static override summary = 'Update a user\'s team roles.';

	static override description = 'You must have administrative access to update a user\'s team roles.';

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

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { args, flags } = await this.parse(TeamUserUpdate);
		const { account, org, sdk } = await initPlatformAccount(flags.account, args.org);

		if (!account.user.roles.includes('administrator')) {
			throw new Error(`You do not have administrative access to update a user's team roles in the "${org.name}" organization`);
		}

		const { team, user } = await sdk.team.user.update(account, org, args.team, args.user, flags.role);

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
			// TODO: Fix this bug with roles never being defined on the results object
			// this.log(`Successfully updated user role${results.roles === 1 ? '' : 's'}`);
		}
	}
}
