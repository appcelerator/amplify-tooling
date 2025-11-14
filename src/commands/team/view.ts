import Command from '../../lib/command.js';
import { Args } from '@oclif/core';
import { highlight, note } from '../../lib/logger.js';

export default class TeamView extends Command {
	static override aliases = [ 'team:info' ];

	static override summary = 'View team information.';

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

	static override examples = [
		{
			description: 'View information about a team',
			command: '<%= config.bin %> <%= command.id %> AcmeCorp DevTeam'
		},
		{
			description: 'View information about a team as JSON',
			command: '<%= config.bin %> <%= command.id %> AcmeCorp DevTeam --json'
		}
	];

	static override enableJsonFlag = true;

	async run(): Promise<any | void> {
		const { args, account, org, sdk } = await this.parse(TeamView);
		const { team } = await sdk.team.find(account, org, args.team);

		if (this.jsonEnabled()) {
			return {
				account: account.name,
				org,
				team
			};
		}

		this.log(`Account:      ${highlight(account.name)}
Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}

Name:         ${highlight(team.name)}
Description:  ${team.desc ? highlight(team.desc) : note('n/a')}
Team GUID:    ${highlight(team.guid)}
Date Created: ${highlight(new Date(team.created).toLocaleString())}
Is Default:   ${highlight(team.default ? 'Yes' : 'No')}
Users:        ${highlight(team.users?.length)}
Apps:         ${highlight(team.apps?.length)}
Tags:         ${team.tags?.length ? highlight(team.tags.map(s => `"${s}"`).join(', ')) : note('n/a')}`);
	}
}
