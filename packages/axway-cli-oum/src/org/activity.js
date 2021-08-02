export default {
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid; defaults to the current org'
		}
	],
	desc: 'Display organization activity report',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer({ style }) {
			return `${style.heading('Example:')}

  You must be authenticated into an Amplify Platform account to view or manage
  organizations. Run ${style.highlight('"axway auth login"')} to authenticate.

  Display organization activity for the past 14 days:
    ${style.highlight('axway org activity <org>')}

  Display organization activity for a specific date range:
    ${style.highlight('axway org activity <org> --from 2021-04-01 --to 2021-04-30')}`;
		}
	},
	options: {
		'--account [name]': 'The platform account to use',
		'--from [yyyy-mm-dd]': {
			desc: 'The start date',
			redact: false
		},
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the org activity as JSON'
		},
		'--to [yyyy-mm-dd]': {
			desc: 'The end date',
			redact: false
		}
	},
	async action({ argv, console }) {
		const { initPlatformAccount } = require('../lib/util');
		const { renderActivity } = require('../lib/activity');
		let { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);

		await renderActivity({
			account,
			console,
			json: argv.json,
			results: {
				account: account.name,
				org,
				...(await sdk.org.activity(account, org, argv))
			}
		});
	}
};
