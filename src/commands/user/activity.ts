export default {
	desc: 'Display your activity',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer({ style }) {
			return `${style.heading('Example:')}

  You must be authenticated to view or manage organizations.
  Run ${style.highlight('"axway auth login"')} to authenticate.

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
	async action() {
		throw new Error('The "user" commands are no longer supported as of version 5.0.0. Their references will be removed in a subsequent release.');
	}
};
