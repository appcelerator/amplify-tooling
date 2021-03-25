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
			desc: 'The team identifier',
			required: true
		}
	],
	desc: 'Removes a team from an organization',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, cli, console }) {
		const { initPlatformAccount } = require('../lib/util');
		let { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);
		const { team } = await sdk.team.remove(account, org, argv.team);
		const results = {
			account: account.name,
			org,
			team
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const { default: snooplogg } = require('snooplogg');
			const { highlight } = snooplogg.styles;

			console.log(`Account: ${highlight(account.name)}\n`);
			console.log(`Successfully removed team ${highlight(team.name)}`);
		}

		await cli.emitAction('axway:oum:team:remove', results);
	}
};
