import { initPlatformAccount } from '../../lib/cli-utils/index.js';
import { renderActivity } from '../../lib/oum/activity.js';

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
    ${style.highlight('axway user activity --from 2021-04-01 --to 2021-04-30')}

  Display your activity for the current month:
    ${style.highlight('axway user activity <org> --month')}`;
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
			desc: 'Outputs the user activity as JSON'
		},
		'--month [mm|yyyy-mm]': {
			desc: 'A month date range; overrides --to and --from',
			redact: false
		},
		'--to [yyyy-mm-dd]': {
			desc: 'The end date',
			redact: false
		}
	},
	async action({ argv, console }) {
		const { account, sdk } = await initPlatformAccount(argv.account, argv.org, argv.env);

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
