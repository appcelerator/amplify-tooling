export default {
	desc: 'Display your activity',
	options: {
		'--account [name]': 'The platform account to use',
		'--from [yyyy-mm-dd]': 'The start date',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the user activity as JSON'
		},
		'--to [yyyy-mm-dd]': 'The end date'
	},
	async action({ argv, console }) {
		const { initPlatformAccount } = require('../lib/util');
		const { renderActivity } = require('../lib/activity');
		const { account, sdk } = await initPlatformAccount(argv.account, argv.org);

		await renderActivity({
			account,
			console,
			json: argv.json,
			results: {
				account: account.name,
				...(await sdk.user.activity(account, argv))
			}
		});
	}
};
