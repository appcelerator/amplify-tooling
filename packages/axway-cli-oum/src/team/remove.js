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
		const { initPlatformAccount } = require('../../lib/util');
		let { account, sdk } = await initPlatformAccount(argv.account);
		const { default: snooplogg } = require('snooplogg');
		const { highlight, note } = snooplogg.styles;

		const result = await sdk.team.remove(account, argv.team);

		console.log(result);

		await cli.emitAction('axway:oum:team:remove', result);
	}
};
