import { highlight, note } from '../../lib/logger.js';
import { Args, Flags } from '@oclif/core';
import Command from '../../lib/command.js';

export default class RemoveTeam extends Command {
	static override summary = 'Remove a team from a service account.';

	static override description = 'You must have administrative access to modify a service account in the organization.';

	static override args = {
		'client-id': Args.string({
			description: 'The service account client id or name.',
			required: true
		}),
		'team-guid': Args.string({
			description: 'The team name or guid.',
			required: true
		})
	};

	static override flags = {
		org: Flags.string({
			description: 'The organization name, id, or guid; defaults to the current org.',
		})
	};

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { args, account, org, sdk } = await this.parse(RemoveTeam);

		if (!account.user.roles.includes('administrator')) {
			throw new Error(`You do not have administrative access to modify a service account in the "${org.name}" organization`);
		}

		const { client: existing } = await sdk.client.find(account, org, args['client-id']);
		const { team } = await sdk.team.find(account, org, args['team-guid']);

		const teams = (existing.teams || [])
			.map(({ guid, roles }) => ({ guid, roles }))
			.filter(t => t.guid !== team.guid);

		const results = await sdk.client.update(account, org, {
			client: existing,
			teams
		});
		results.account = account;

		if (this.jsonEnabled()) {
			return results;
		}

		this.log(`Account:      ${highlight(account.name)}`);
		this.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		const { client_id, name } = results.client;
		this.log(`Successfully removed team ${highlight(team.name)} from service account ${highlight(name)} ${note(`(${client_id})`)}`);
	}
}
