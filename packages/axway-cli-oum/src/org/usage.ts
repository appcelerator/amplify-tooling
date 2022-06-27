/* eslint-disable no-loop-func */

import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';
import { UsageBundleMetric } from '@axway/amplify-sdk';
import { CLICommand, CLIHelpOptions } from 'cli-kit';

interface BundleEnvironment {
	guid: string,
	name: string,
	production: boolean,
	quota: number,
	tokens: number,
	value: number
}

interface BundleMetric {
	envs: BundleEnvironment[],
	name: string,
	tokens: number,
	unit: string,
	value: number
}

interface BundleMetrics {
	[name: string]: BundleMetric
}

interface ProductMetric {
	[name: string]: SubproductMetric
}

interface ProductEnvironment {
	name: string
}

interface SubproductMetric {
	envs: ProductEnvironment[],
	formatted: string,
	unlimited: boolean
}

interface GovernanceMetrics {
	[name: string]: ProductMetric
}

interface ProductMeta {
	name: string,
	governance: GovernanceMetrics
}

interface UsageMetrics {
	[product: string]: ProductMeta
}

export default {
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid; defaults to the current org'
		}
	],
	desc: 'Display organization usage report',
	help: {
		header(this: CLICommand) {
			return `${this.desc}.`;
		},
		footer({ style }: CLIHelpOptions): string {
			return `${style.heading('Example:')}

  You must be authenticated into an Amplify Platform account to view or manage
  organizations. Run ${style.highlight('"axway auth login"')} to authenticate.

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
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
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
	async action({ argv, console }: AxwayCLIState): Promise<void> {
		// const { formatDate } = await import('../lib/util');
		// const { createTable, initPlatformAccount } = await import('@axway/amplify-cli-utils');
		// let { account, org, sdk } = await initPlatformAccount(argv.account as string, argv.org as string, argv.env as string);
		// const { bundle, from, to, usage } = await sdk.org.usage(account, org, {
		// 	from: argv.from as string,
		// 	month: argv.month as string | boolean,
		// 	to: argv.to as string
		// });
		// const orgEnvs = await sdk.org.environments(account);
		// const maxEntitlement = 9999999999999;
		// const { format } = new Intl.NumberFormat();
		// let bundleValuePadding = 0;
		// let saasPercentPadding = 0;
		// let saasValuePadding = 0;
		// let bundleMetricsScrubbed: BundleMetrics | undefined;
		// let usageMetricsScrubbed: UsageMetrics = {};

		// // pre-determine the bundle metric environments
		// if (bundle) {
		// 	bundleMetricsScrubbed = {};
		// 	const metricEntries: [ string, UsageBundleMetric ][] = Object.entries(bundle.metrics as any);
		// 	for (const [ name, metric ] of metricEntries) {
		// 		bundleMetricsScrubbed[name] = {
		// 			...metric,
		// 			envs: Object.entries(metric.envs).map(([ guid, stats ]) => {
		// 				bundleValuePadding = Math.max(bundleValuePadding, String(format(stats.value)).length);
		// 				return {
		// 					...stats,
		// 					guid,
		// 					name: orgEnvs.find(e => e.guid === guid)?.name || guid
		// 				};
		// 			})
		// 		};
		// 	}
		// }

		// // pre-determine the saas metric environments
		// for (const [ product, usageMeta ] of Object.entries(usage)) {
		// 	const governance: GovernanceMetrics = {};
		// 	for (const [ govName, govMetrics ] of Object.entries(usageMeta.governance)) {
		// 		const metrics: ProductMetric = {};
		// 		for (const [ name, info ] of Object.entries(govMetrics)) {
		// 			const formatted = `${format(info.value)} of ${info.unlimited ? 'Unlimited' : format(info.quota)}`;

		// 			if (typeof info.percent === 'number') {
		// 				saasPercentPadding = Math.max(saasPercentPadding, String(info.percent).length);
		// 			}
		// 			saasValuePadding = Math.max(saasValuePadding, formatted.length);

		// 			metrics[name] = {
		// 				envs: Object.entries(info.envs || {}).map(([ name, stats ]) => {
		// 					const formatted = format(stats.value);
		// 					const percent = stats.quota && Math.floor(Math.min(stats.value / stats.quota * 100, 100));

		// 					saasPercentPadding = Math.max(saasPercentPadding, String(stats.percent).length);
		// 					saasValuePadding = Math.max(saasValuePadding, stats.formatted.length);

		// 					return { ...stats, formatted, name, percent };
		// 				}),
		// 				formatted,
		// 				unlimited: info.quota === maxEntitlement
		// 			};
		// 		}
		// 		governance[govName] = metrics;
		// 	}

		// 	usageMetricsScrubbed[product] = {
		// 		name: usageMeta.name,
		// 		governance
		// 	};
		// }

		// const results = {
		// 	account: account.name,
		// 	org,
		// 	from,
		// 	to,
		// 	bundle: {
		// 		...bundle,
		// 		metrics: bundleMetricsScrubbed
		// 	},
		// 	usage: usageMetricsScrubbed
		// };

		// if (argv.json) {
		// 	console.log(JSON.stringify(results, null, 2));
		// 	return;
		// }

		// const { default: snooplogg } = await import('snooplogg');
		// const { bold, gray, green, highlight, note, red, yellow } = snooplogg.styles;

		// console.log(`Account:      ${highlight(account.name)}`);
		// console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}`);
		// console.log(`Date Range:   ${highlight(formatDate(from))} and ${highlight(formatDate(to))}`);

		// const renderBar = (percent: number, width: number): string => {
		// 	const used = Math.ceil(width * Math.min(percent, 100) / 100);
		// 	const color = percent > 85 ? red : percent > 65 ? yellow : green;
		// 	return `${color('\u25A0'.repeat(used))}${gray('⠂'.repeat(width - used))} ${renderPercent(percent)}`;
		// };

		// const renderPercent = (percent: number): string => {
		// 	let label = `${percent}%`.padStart(saasPercentPadding + 1);
		// 	return (percent > 85 ? red(label) : percent > 65 ? yellow(label) : label);
		// };

		// API Management Platform Usage
		// if (bundle) {
		// 	console.log(`\n${bold(bundle.name)} - ${highlight(bundle.edition)}`);
		// 	console.log(
		// 		`  ${highlight(`${format(bundle.value)} / ${format(bundle.quota)}`)} ${bundle.units}`
		// 		+ `  ${renderBar(bundle.percent, 40)}`
		// 	);

		// 	const table = createTable();
		// 	for (const [ name, metric ] of Object.entries(bundleScrubbed.metrics)) {
		// 		table.push([
		// 			`  ${bold(metric.name || name)}`,
		// 			'',
		// 			{ content: `${highlight(format(metric.value))} ${bundleScrubbed.units}`, hAlign: 'right' }
		// 		]);

		// 		const ratio = bundleScrubbed.ratios[name];

		// 		// render the envs
		// 		for (let i = 0, len = metric.envs.length; i < len; i++) {
		// 			const env = metric.envs[i];
		// 			table.push([
		// 				`  ${i + 1 === len ? '└─' : '├─'} ${env.name} ${env.production ? gray('Production') : ''}`,
		// 				`${highlight(format(env.value).padStart(bundleValuePadding))} Transactions${env.tokens && ratio !== 1 ? highlight(` x ${(ratio / 100).toFixed(1)}`) : ''}`,
		// 				env.tokens ? { content: `${highlight(format(env.tokens))} ${bundleScrubbed.units}`, hAlign: 'right' } : ''
		// 			]);
		// 		}
		// 	}
		// 	if (table.length) {
		// 		console.log();
		// 		console.log(table.toString());
		// 	}
		// }

		// Project usage
		// const table = createTable();
		// for (const [ label, meta ] of Object.entries(usageScrubbed)) {
		// 	const metrics = Object.values(meta);
		// 	if (!metrics.length) {
		// 		continue;
		// 	}

		// 	table.push([ `\n${bold(label)}` ]);

		// 	// print the usage
		// 	for (const { envs, formatted, name, percent, unit, unlimited } of metrics) {
		// 		table.push([
		// 			`  ${bold(name)}`,
		// 			`${highlight(formatted.padStart(saasValuePadding))} ${unit}`,
		// 			unlimited || typeof percent !== 'number' ? '' : `${renderBar(percent, 20)}`
		// 		]);

		// 		// render the envs
		// 		for (let i = 0, len = envs.length; i < len; i++) {
		// 			const { formatted, name, production } = envs[i];
		// 			if (name !== 'default') {
		// 				table.push([
		// 					`  ${i + 1 === len ? '└─' : '├─'} ${name} ${production ? gray('Production') : ''}`,
		// 					`${highlight(formatted.padStart(saasValuePadding))} ${unit}`,
		// 					''
		// 				]);
		// 			}
		// 		}
		// 	}
		// }
		// if (table.length) {
		// 	console.log(table.toString());
		// } else if (!bundleScrubbed) {
		// 	console.log('\nNo usage data');
		// }
	}
};
