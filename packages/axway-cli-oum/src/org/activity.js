export default {
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid; defaults to the current org'
		}
	],
	desc: 'Display organization activity report',
	options: {
		'--account [name]': 'The platform account to use',
		'--from [yyyy-mm-dd]': 'The start date',
		'--json': 'Outputs accounts as JSON',
		'--to [yyyy-mm-dd]': 'The end date'
	},
	async action({ argv, console }) {
		const { initPlatformAccount } = require('../lib/util');
		const { renderActivity } = require('../lib/activity');
		let { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);
		const results = await sdk.org.activity(account, org.guid, argv);

		results.org = org;

		await renderActivity({
			account,
			console,
			json: argv.json,
			results
		});
	}
};
