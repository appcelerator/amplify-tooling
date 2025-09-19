import { initPlatformAccount } from '../../lib/utils.js';
import { createTable } from '../../lib/formatter.js';
import snooplogg from 'snooplogg';

/* eslint-disable no-loop-func */

export default {
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid; defaults to the current org'
		}
	],
	desc: 'Display organization usage report',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer({ style }) {
			return `${style.heading('Example:')}

  You must be authenticated to view or manage organizations.
  Run ${style.highlight('"axway auth login"')} to authenticate.

  Display organization usage for the past 14 days:
    ${style.highlight('axway org usage <org>')}

  Display organization usage for a specific date range:
    ${style.highlight('axway org usage <org> --from 2021-04-01 --to 2021-04-30')}

  Display organization usage for the current month:
    ${style.highlight('axway org usage <org> --month')}`;
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
			desc: 'Outputs the usage as JSON'
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
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org, argv.env);
		const { bundle, from, to, usage } = await sdk.org.usage(account, org, argv);
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

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
			return;
		}

		const { bold, gray, green, highlight, note, red, yellow } = snooplogg.styles;

		console.log(`Account:      ${highlight(account.name)}`);
		console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}`);
		console.log(`Date Range:   ${highlight(formatDate(from))} and ${highlight(formatDate(to))}`);

		const renderBar = (percent, width) => {
			const used = Math.ceil(width * Math.min(percent, 100) / 100);
			const color = percent > 85 ? red : percent > 65 ? yellow : green;
			return `${color('\u25A0'.repeat(used))}${gray('⠂'.repeat(width - used))} ${renderPercent(percent)}`;
		};

		const renderPercent = percent => {
			const label = `${percent}%`.padStart(saasPercentPadding + 1);
			return (percent > 85 ? red(label) : percent > 65 ? yellow(label) : label);
		};

		// API Management Platform Usage
		if (bundle) {
			console.log(`\n${bold(bundle.name)} - ${highlight(bundle.edition)}`);
			console.log(
				`  ${highlight(`${format(bundle.value)} / ${format(bundle.quota)}`)} ${bundle.units}`
				+ `  ${renderBar(bundle.percent, 40)}`
			);

			const table = createTable();
			for (const [ name, metric ] of Object.entries(bundle.metrics) as any) {
				table.push([
					`  ${bold(metric.name || name)}`,
					'',
					{ content: `${highlight(format(metric.value))} ${bundle.units}`, hAlign: 'right' }
				]);

				const ratio = bundle.ratios[name];

				// render the envs
				for (let i = 0, len = metric.envs.length; i < len; i++) {
					const env = metric.envs[i];
					table.push([
						`  ${i + 1 === len ? '└─' : '├─'} ${env.name} ${env.production ? gray('Production') : ''}`,
						`${highlight(format(env.value).padStart(bundleValuePadding))} Transactions${env.tokens && ratio !== 1 ? highlight(` x ${(ratio / 100).toFixed(1)}`) : ''}`,
						env.tokens ? { content: `${highlight(format(env.tokens))} ${bundle.units}`, hAlign: 'right' } : ''
					]);
				}
			}
			if (table.length) {
				console.log();
				console.log(table.toString());
			}
		}

		// Project usage
		const table = createTable();
		for (const [ label, data ] of Object.entries(usage)) {
			const metrics = Object.values(data);
			if (!metrics.length) {
				continue;
			}

			table.push([ `\n${bold(label)}` ]);

			// print the usage
			for (const { envs, formatted, name, percent, unit, unlimited } of metrics) {
				table.push([
					`  ${bold(name)}`,
					`${highlight(formatted.padStart(saasValuePadding))} ${unit}`,
					unlimited || typeof percent !== 'number' ? '' : `${renderBar(percent, 20)}`
				]);

				// render the envs
				for (let i = 0, len = envs.length; i < len; i++) {
					const { formatted, name, production } = envs[i];
					if (name !== 'default') {
						table.push([
							`  ${i + 1 === len ? '└─' : '├─'} ${name} ${production ? gray('Production') : ''}`,
							`${highlight(formatted.padStart(saasValuePadding))} ${unit}`,
							''
						]);
					}
				}
			}
		}
		if (table.length) {
			console.log(table.toString());
		} else if (!bundle) {
			console.log('\nNo usage data');
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
