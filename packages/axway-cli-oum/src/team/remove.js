export default {
	aliases: [ 'rm' ],
	args: [
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
		let { account, sdk } = await initPlatformAccount(argv.account);
		const { default: snooplogg } = require('snooplogg');
		const { highlight } = snooplogg.styles;

		if (!argv.json) {
			console.log(`Account: ${highlight(account.name)}\n`);
		}

		const team = await sdk.team.remove(account, argv.team);
		const results = {
			account: account.name,
			team
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			console.log(`Successfully removed team ${highlight(team.name)}`);
		}

		await cli.emitAction('axway:oum:team:remove', results);
	}
};
