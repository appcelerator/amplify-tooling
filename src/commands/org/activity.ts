import { renderActivity } from '../../lib/activity.js';
import { highlight } from '../../lib/logger.js';
import { Args, Flags } from '@oclif/core';
import Command from '../../lib/command.js';

export default class OrgActivity extends Command {
	static override summary = 'Display organization activity report.';

	static override description = `You must be authenticated to view or manage organizations.
Run ${highlight('"<%= config.bin %> auth login"')} to authenticate.`;

	static override args = {
		org: Args.string({
			description: 'The organization name, id, or guid; defaults to the current org.',
			required: false
		})
	};

	static override flags = {
		from: Flags.string({
			description: 'The start date (yyyy-mm-dd).'
		}),
		to: Flags.string({
			description: 'The end date (yyyy-mm-dd).'
		}),
		month: Flags.string({
			description: 'A month date range; overrides --to and --from (mm|yyyy-mm).'
		})
	};

	static override examples = [
		{
			description: 'Display organization activity for the past 14 days',
			command: '<%= config.bin %> <%= command.id %> <org>'
		},
		{
			description: 'Display organization activity for a specific date range',
			command: '<%= config.bin %> <%= command.id %> <org> --from 2021-04-01 --to 2021-04-30'
		},
		{
			description: 'Display organization activity for the current month',
			command: '<%= config.bin %> <%= command.id %> <org> --month'
		}
	];

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { flags, account, org, sdk } = await this.parse(OrgActivity);

		const results = {
			account: account.name,
			org,
			...(await sdk.org.activity(account, org, flags))
		};

		if (this.jsonEnabled()) {
			return results;
		}

		await renderActivity({
			account,
			log: this.log.bind(this),
			results
		});
	}
}
