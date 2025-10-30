import chalk from 'chalk';
import { initPlatformAccount } from '../../lib/utils.js';
import { createTable } from '../../lib/formatter.js';
import { highlight, note } from '../../lib/logger.js';
import { Args, Flags } from '@oclif/core';
import Command from '../../lib/command.js';

export default class OrgUsage extends Command {
	static override summary = 'Display organization usage report.';

	static override description = `You must be authenticated to view or manage organizations.
Run ${highlight('"<%= config.bin %> auth login"')} to authenticate.`;

	static override args = {
		org: Args.string({
			description: 'The organization name, id, or guid; defaults to the current org',
			required: false
		})
	};

	static override flags = {
		account: Flags.string({
			description: 'The platform account to use'
		}),
		from: Flags.string({
			description: 'The start date (yyyy-mm-dd)'
		}),
		to: Flags.string({
			description: 'The end date (yyyy-mm-dd)'
		}),
		month: Flags.string({
			description: 'A month date range; overrides --to and --from'
		})
	};

	static override examples = [
		{
			description: 'Display organization usage for the past 14 days',
			command: '<%= config.bin %> <%= command.id %> <org>'
		},
		{
			description: 'Display organization usage for a specific date range',
			command: '<%= config.bin %> <%= command.id %> <org> --from 2021-04-01 --to 2021-04-30'
		},
		{
			description: 'Display organization usage for the current month',
			command: '<%= config.bin %> <%= command.id %> <org> --month'
		}
	];

	static override enableJsonFlag = true;

	async run(): Promise<any | void> {
		const { args, flags } = await this.parse(OrgUsage);
		const { account, org, sdk } = await initPlatformAccount(flags.account, args.org);
		const { bundle, from, to, usage } = await sdk.org.usage(account, org, flags);
		const orgEnvs = await sdk.org.environments(account);
		const maxEntitlement = 9999999999999;
		const { format } = new Intl.NumberFormat();
		let bundleValuePadding = 0;
		let saasPercentPadding = 0;
		let saasValuePadding = 0;

		// pre-determine the bundle metric environments
		if (bundle) {
			for (const metric of Object.values(bundle.metrics) as any) {
				metric.envs = Object.entries(metric.envs).map(([ guid, stats ]: any) => {
					bundleValuePadding = Math.max(bundleValuePadding, String(format(stats.value)).length);
					return {
						...stats,
						guid,
						name: orgEnvs.find(e => e.guid === guid)?.name || guid
					};
				});
			}
		}

		// pre-determine the saas metric environments
		for (const data of Object.values(usage)) {
			for (const info of Object.values(data)) {
				// info.quota = maxEntitlement;
				info.unlimited = info.quota === maxEntitlement;
				info.formatted = `${format(info.value)} of ${info.unlimited ? 'Unlimited' : format(info.quota)}`;

				if (typeof info.percent === 'number') {
					saasPercentPadding = Math.max(saasPercentPadding, String(info.percent).length);
				}
				saasValuePadding = Math.max(saasValuePadding, info.formatted.length);

				info.envs = Object.entries(info.envs || {}).map(([ name, stats ]: any) => {
					stats.formatted = format(stats.value);
					stats.percent = stats.quota && Math.floor(Math.min(stats.value / stats.quota * 100, 100));

					saasPercentPadding = Math.max(saasPercentPadding, String(stats.percent).length);
					saasValuePadding = Math.max(saasValuePadding, stats.formatted.length);

					return { name, ...stats };
				});
			}
		}

		const results = {
			account: account.name,
			org,
			from,
			to,
			bundle,
			usage
		};

		if (this.jsonEnabled()) {
			return results;
		}

		this.log(`Account:      ${highlight(account.name)}`);
		this.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}`);
		this.log(`Date Range:   ${highlight(formatDate(from))} and ${highlight(formatDate(to))}`);

		const renderBar = (percent, width) => {
			const used = Math.ceil(width * Math.min(percent, 100) / 100);
			const color = percent > 85 ? chalk.red : percent > 65 ? chalk.yellow : chalk.green;
			return `${color('\u25A0'.repeat(used))}${chalk.gray('⠂'.repeat(width - used))} ${renderPercent(percent)}`;
		};

		const renderPercent = percent => {
			const label = `${percent}%`.padStart(saasPercentPadding + 1);
			return (percent > 85 ? chalk.red(label) : percent > 65 ? chalk.yellow(label) : label);
		};

		// API Management Platform Usage
		if (bundle) {
			this.log(`\n${chalk.bold(bundle.name)} - ${highlight(bundle.edition)}`);
			this.log(
				`  ${highlight(`${format(bundle.value)} / ${format(bundle.quota)}`)} ${bundle.units}`
				+ `  ${renderBar(bundle.percent, 40)}`
			);

			const table = createTable();
			for (const [ name, metric ] of Object.entries(bundle.metrics) as any) {
				table.push([
					`  ${chalk.bold(metric.name || name)}`,
					'',
					{ content: `${highlight(format(metric.value))} ${bundle.units}`, hAlign: 'right' }
				]);

				const ratio = bundle.ratios[name];

				// render the envs
				for (let i = 0, len = metric.envs.length; i < len; i++) {
					const env = metric.envs[i];
					table.push([
						`  ${i + 1 === len ? '└─' : '├─'} ${env.name} ${env.production ? chalk.gray('Production') : ''}`,
						`${highlight(format(env.value).padStart(bundleValuePadding))} Transactions${env.tokens && ratio !== 1 ? highlight(` x ${(ratio / 100).toFixed(1)}`) : ''}`,
						env.tokens ? { content: `${highlight(format(env.tokens))} ${bundle.units}`, hAlign: 'right' } : ''
					]);
				}
			}
			if (table.length) {
				this.log();
				this.log(table.toString());
			}
		}

		// Project usage
		const table = createTable();
		for (const [ label, data ] of Object.entries(usage)) {
			const metrics = Object.values(data);
			if (!metrics.length) {
				continue;
			}

			table.push([ `\n${chalk.bold(label)}` ]);

			// print the usage
			for (const { envs, formatted, name, percent, unit, unlimited } of metrics) {
				table.push([
					`  ${chalk.bold(name)}`,
					`${highlight(formatted.padStart(saasValuePadding))} ${unit}`,
					unlimited || typeof percent !== 'number' ? '' : `${renderBar(percent, 20)}`
				]);

				// render the envs
				for (let i = 0, len = envs.length; i < len; i++) {
					const { formatted, name, production } = envs[i];
					if (name !== 'default') {
						table.push([
							`  ${i + 1 === len ? '└─' : '├─'} ${name} ${production ? chalk.gray('Production') : ''}`,
							`${highlight(formatted.padStart(saasValuePadding))} ${unit}`,
							''
						]);
					}
				}
			}
		}
		if (table.length) {
			this.log(table.toString());
		} else if (!bundle) {
			this.log('\nNo usage data');
		}
	}
};

/**
 * Formats a date in the format "m/d/yyyy".
 * TODO: Replace this with Intl for locale-relative date formatting, or use yyyy-mm-dd to match args
 * @param {Date|Number} dt - The date to format.
 * @returns {String}
 */
export function formatDate(dt) {
	if (!(dt instanceof Date)) {
		dt = new Date(dt);
	}
	return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}/${dt.getUTCFullYear()}`;
}
