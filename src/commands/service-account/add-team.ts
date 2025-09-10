import { initPlatformAccount } from '../../lib/utils.js';
import snooplogg from 'snooplogg';

export default {
	args: [
		{
			desc: 'The service account client id or name',
			hint: 'client-id/name',
			name: 'client-id',
			required: true
		},
		{
			desc: 'The team name or guid',
			hint: 'team-guid/name',
			name: 'team-guid',
			required: true
		},
		{
			desc: 'The team role',
			name: 'role',
			required: true
		}
	],
	desc: 'Add a team to a service account',
	help: {
		header() {
			return `${this.desc}.`;
		}
	},
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the result as JSON'
		},
		'--org [name|id|guid]': 'The organization name, id, or guid'
	},
	async action({ argv, cli, console }) {
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org, argv.env);

		if (!org.userRoles.includes('administrator')) {
			throw new Error(`You do not have administrative access to modify a service account in the "${org.name}" organization`);
		}

		// get the service account and team
		const { client: existing } = await sdk.client.find(account, org, argv.clientId);
		const { team } = await sdk.team.find(account, org, argv.teamGuid);

		// add the team to the existing list of teams
		const teams = (existing.teams || []).map(({ guid, roles }) => ({ guid, roles }));
		teams.push({
			guid: team.guid,
			roles: [ argv.role ]
		});

		// update the service account
		const results = await sdk.client.update(account, org, {
			client: existing,
			teams
		});
		results.account = account;

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const { highlight, note } = snooplogg.styles;

			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

			const { client_id, name } = results.client;
			console.log(`Successfully add team ${highlight(team.name)} to service account ${highlight(name)} ${note(`(${client_id})`)}`);
		}

		await cli.emitAction('axway:auth:service-account:add-team', results);
	}
};
