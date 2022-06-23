import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';
import { CLICommand, CLIHelpOptions } from 'cli-kit';

export default {
	desc: 'Display your activity',
	help: {
		header(this: CLICommand) {
			return `${this.desc}.`;
		},
		footer({ style }: CLIHelpOptions): string {
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
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
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
	async action({ argv, console }: AxwayCLIState): Promise<void> {
		const { initPlatformAccount } = await import('@axway/amplify-cli-utils');
		const { renderActivity } = await import('../lib/activity');
		const { account, sdk } = await initPlatformAccount(argv.account as string, argv.org as string, argv.env as string);

		await renderActivity({
			account,
			console,
			json: !!argv.json,
			results: {
				account: account.name,
				...(await sdk.user.activity(account, argv))
			}
		});
	}
};
