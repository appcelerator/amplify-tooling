export default {
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid; defaults to the current org'
		}
	],
	desc: 'Display organization usage report',
	options: {
		'--account [name]': 'The platform account to use',
		'--from [yyyy-mm-dd]': 'The start date',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs accounts as JSON'
		},
		'--to [yyyy-mm-dd]': 'The end date'
	},
	async action({ argv, console }) {
		const { initPlatformAccount } = require('../lib/util');
		const { createTable } = require('@axway/amplify-cli-utils');
		let { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);
		const { from, to, usage } = await sdk.org.usage(account, org, argv);
		const results = {
			account: account.name,
			org,
			from,
			to,
			usage
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
			return;
		}

		const { default: snooplogg } = require('snooplogg');
		const { gray, green, highlight, note, red, yellow } = snooplogg.styles;

		console.log(`Account:      ${highlight(account.name)}`);
		console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}`);
		console.log(`Date Range:   ${highlight(new Date(from).toLocaleDateString())} and ${highlight((to ? new Date(to) : new Date()).toLocaleDateString())}\n`);

		if (!usage.SaaS) {
			console.log('No usage found');
			return;
		}

		const bar = pct => {
			const width = 20;
			const used = Math.ceil(width * pct);
			const color = pct > 85 ? red : pct > 65 ? yellow : green;
			return `${color('\u25A0'.repeat(used))}${gray('⠂'.repeat(width - used))} ${Math.round(pct * 100)}%`;
		};

		const table = createTable();
		const { format } = new Intl.NumberFormat();
		for (const { name, quota, unit, value } of Object.values(usage.SaaS)) {
			table.push([
				name,
				highlight(`${format(value)} / ${format(quota)} ${unit}`),
				bar(value / quota)
			]);
		}
		console.log(table.toString());
	}
};
