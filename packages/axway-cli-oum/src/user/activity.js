export default {
	desc: 'Display your activity',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer({ style }) {
			return `${style.heading('Example:')}

  You must be authenticated into an Amplify Platform account to view or manage
  organizations. Run ${style.highlight('"axway auth login"')} to authenticate.

  Display your user activity for the past 14 days:
    ${style.highlight('axway user activity')}

  Display your activity for a specific date range:
    ${style.highlight('axway user activity --from 2021-04-01 --to 2021-04-30')}`;
		}
	},
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
