import Command from '../../lib/command.js';
import { Args, Flags } from '@oclif/core';
import { highlight, note } from '../../lib/logger.js';

export default class TeamUpdate extends Command {
	static override aliases = [
		'team:up'
	];

	static override summary = 'Update team information.';

	static override description = `You must be authenticated to view or manage organizations.
Run ${highlight('"axway auth login"')} to authenticate.`;

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

	static override flags = {
		default: Flags.boolean({
			description: 'Set the team as the default team.'
		}),
		desc: Flags.string({
			description: 'The description of the team.'
		}),
		name: Flags.string({
			description: 'The team name.'
		}),
		tag: Flags.string({
			description: 'One or more tags to assign to the team.',
			multiple: true,
			aliases: [ 'tags' ]
		}),
	};

	static override examples = [
		{
			description: 'Rename the team',
			command: '<%= config.bin %> <%= command.id %> <org> <team> --name <new name>'
		},
		{
			description: 'Update the team description',
			command: '<%= config.bin %> <%= command.id %> <org> <team> --desc <new description>'
		},
		{
			description: 'Redefine the team tags',
			command: '<%= config.bin %> <%= command.id %> <org> <team> --tag <tag1> --tag <tag2>'
		}
	];

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { args, flags, account, org, sdk } = await this.parse(TeamUpdate);

		if (!account.user.roles.includes('administrator')) {
			throw new Error(`You do not have administrative access to update a team in the "${org.name}" organization`);
		}

		const { changes, team } = await sdk.team.update(account, org, args.team, {
			desc:    flags.desc,
			default: flags.default,
			name:    flags.name,
			tags:    flags.tag
		});
		const results = {
			account: account.name,
			changes,
			org,
			team
		};

		if (this.jsonEnabled()) {
			return results;
		}

		const labels = {
			default: 'is default',
			desc:    'description',
			name:    'name',
			tags:    'tags'
		};
		const format = it => {
			return Array.isArray(it) ? `[${it.map(s => `"${s === undefined ? '' : s}"`).join(', ')}]` : `"${it === undefined ? '' : it}"`;
		};

		this.log(`Account: ${highlight(account.name)}`);
		this.log(`Team:    ${highlight(team.name)} ${note(`(${team.guid})`)}\n`);

		if (Object.keys(changes).length) {
			for (const [ key, { v, p } ] of Object.entries(changes) as any) {
				this.log(`Updated ${highlight(labels[key])} from ${highlight(format(p))} to ${highlight(format(v))}`);
			}
		} else {
			this.log('No values were changed');
		}
	}
}
