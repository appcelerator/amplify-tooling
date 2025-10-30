import Command from '../../lib/command.js';
import { Args, Flags } from '@oclif/core';
import { highlight, note } from '../../lib/logger.js';
import { initPlatformAccount } from '../../lib/utils.js';

export default class TeamCreate extends Command {
	static override aliases = [
		'team:add',
		'team:new'
	];

	static override summary = 'Create a new team for an organization.';

	static override examples = [
		{
			description: 'Create a team named "devs" for organization "acme"',
			command: 'amplify team create acme devs'
		},
		{
			description: 'Create a team with tags and description',
			command: 'amplify team create acme devs --desc "Developers team" --tag frontend --tag backend'
		},
		{
			description: 'Create a team and output as JSON',
			command: 'amplify team create acme devs --json'
		}
	];

	static override enableJsonFlag = true;

	static override args = {
		org: Args.string({
			description: 'The organization name, id, or guid',
			required: true
		}),
		name: Args.string({
			description: 'The name of the team',
			required: true
		})
	};

	static override flags = {
		account: Flags.string({
			description: 'The platform account to use'
		}),
		default: Flags.boolean({
			description: 'Set the team as the default team'
		}),
		desc: Flags.string({
			description: 'The description of the team'
		}),
		tag: Flags.string({
			description: 'One or more tags to assign to the team',
			multiple: true,
			aliases: [ 'tags' ]
		})
	};

	async run(): Promise<any> {
		const { args, flags } = await this.parse(TeamCreate);
		const { account, org, sdk } = await initPlatformAccount(flags.account, args.org, flags.env);

		if (!account.user.roles.includes('administrator')) {
			throw new Error(`You do not have administrative access to add a new team to the "${org.name}" organization`);
		}

		const { team } = await sdk.team.create(account, org, args.name, {
			desc:    flags.desc,
			default: flags.default,
			tags:    flags.tag
		});
		const results = {
			account: account.name,
			org,
			team
		};

		if (this.jsonEnabled()) {
			return results;
		} else {
			this.log(`Account:      ${highlight(account.name)}`);
			this.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
			this.log(`Successfully created team ${highlight(team.name)} ${note(`(${team.guid})`)}`);
		}
	}
}
