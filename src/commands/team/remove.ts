import { initPlatformAccount } from '../../lib/utils.js';
import { highlight } from '../../lib/logger.js';

export default {
	aliases: [ 'rm' ],
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid',
			required: true
		},
		{
			name: 'team',
			desc: 'The team name or guid',
			required: true
		}
	],
	desc: 'Remove a team from an organization',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the result as JSON'
		}
	},
	async action({ argv, cli, console }) {
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org, argv.env);

		if (!account.user.roles.includes('administrator')) {
			throw new Error(`You do not have administrative access to remove a team from the "${org.name}" organization`);
		}

		const { team } = await sdk.team.remove(account, org, argv.team);
		const results = {
			account: account.name,
			org,
			team
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			console.log(`Account: ${highlight(account.name)}\n`);
			console.log(`Successfully removed team ${highlight(team.name)}`);
		}

		await cli.emitAction('axway:oum:team:remove', results);
	}
};
