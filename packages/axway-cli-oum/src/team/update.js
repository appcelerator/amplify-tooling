export default {
	args: [
		{
			name: 'team',
			desc: 'The team identifier',
			required: true
		}
	],
	desc: 'Update the team information',
	options: {
		'--account [name]': 'The platform account to use',
		'--desc [value]': 'The description of the team',
		'--json': 'Outputs accounts as JSON',
		'--name [value]': 'The team name'
	},
	async action({ argv, cli, console }) {
		const { initPlatformAccount } = require('../../lib/util');
		let { account, sdk } = await initPlatformAccount(argv.account);
		const { default: snooplogg } = require('snooplogg');
		const { highlight, note } = snooplogg.styles;

		const result = await sdk.team.update(account, argv.team, {
			desc: argv.desc,
			name: argv.name
		});

		console.log(result);

		await cli.emitAction('axway:oum:team:update', result);
	}
};
