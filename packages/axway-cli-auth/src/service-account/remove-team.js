export default {
	args: [
		{
			desc: 'The service account client id or name',
			hint: 'client-id/name',
			name: 'id',
			required: true
		},
		{
			desc: 'The team name or guid',
			hint: 'team-guid/name',
			name: 'guid',
			required: true
		}
	],
	desc: 'Remove a team from a service account',
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
		const { initPlatformAccount } = require('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);

		if (!org.userRoles.includes('administrator')) {
			throw new Error(`You do not have administrative access to modify a service account in the "${org.name}" organization`);
		}

		// get the service account and team
		const { client: existing } = await sdk.client.find(account, org, argv.id);
		const { team } = await sdk.team.find(account, org, argv.guid);

		// add the team to the existing list of teams
		const teams = (existing.teams || [])
			.map(({ guid, roles }) => ({ guid, roles }))
			.filter(t => t.guid !== team.guid);

		// update the service account
		const results = await sdk.client.update(account, org, {
			client: existing,
			teams
		});
		results.account = account;

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const { default: snooplogg } = require('snooplogg');
			const { highlight, note } = snooplogg.styles;

			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

			const { client_id, name } = results.client;
			console.log(`Successfully removed team ${highlight(team.name)} from service account ${highlight(name)} ${note(`(${client_id})`)}`);
		}

		await cli.emitAction('axway:auth:service-account:remove-team', results);
	}
};
