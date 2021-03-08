export default {
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid; defaults to the current org',
			required: true
		},
		{
			name: 'name',
			desc: 'The new organization name',
			required: true
		}
	],
	desc: 'Rename an organization',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': 'Outputs the result as JSON'
	},
	async action({ argv, cli, console }) {
		const { initPlatformAccount } = require('../lib/util');
		const { default: snooplogg } = require('snooplogg');
		const { highlight } = snooplogg.styles;
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);
		const result = await sdk.org.rename(account, org, argv.name);

		if (argv.json) {
			console.log(JSON.stringify(result, null, 2));
			return;
		}

		console.log(`Account: ${highlight(account.name)}\n`);

		console.log(`Successfully renamed "${result.oldName}" to "${result.name}"`);

		await cli.emitAction('axway:oum:org:rename', result);
	}
};
