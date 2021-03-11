export default {
	desc: 'Display your activity',
	options: {
		'--account [name]': 'The platform account to use',
		'--from [yyyy-mm-dd]': 'The start date',
		'--json': 'Outputs accounts as JSON',
		'--to [yyyy-mm-dd]': 'The end date'
	},
	async action({ argv, console }) {
		const { initPlatformAccount } = require('../lib/util');
		const { account, sdk } = await initPlatformAccount(argv.account, argv.org);

		const results = await sdk.user.activity(account, argv);

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
			return;
		}

		const { createTable } = require('@axway/amplify-cli-utils');
		const { default: snooplogg } = require('snooplogg');
		const { highlight, note } = snooplogg.styles;
		const { from, to, events } = results;

		console.log(`Activity between ${highlight(from.toLocaleDateString())} and ${highlight(to ? to.toLocaleDateString() : 'today')}\n`);

		const table = createTable([ 'Date', 'Description', 'Event Name', 'Organization' ]);
		for (const event of events) {
			let changes = '';
			if (Array.isArray(event.data.changes)) {
				const t = str => str.toLowerCase().replace(/(?:^|\s|-)\S/g, c => c.toUpperCase());
				changes = event.data.changes.map((c, i, arr) => {
					let unit;

					if (c.k.startsWith('entitlements.')) {
						const ent = c.k.replace('entitlements.', '');
						unit = ent.split('.').slice(-1);
						c.k = `Entitlement ${t(ent)}`;
					} else {
						c.k = t(c.k);
					}

					for (const prop of [ 'o', 'v' ]) {
						if (Object.prototype.hasOwnProperty.call(c, prop)) {
							const d = new Date(c[prop]);
							if (!isNaN(d)) {
								c[prop] = d.toLocaleDateString();
								continue;
							}

							if (Array.isArray(c[prop])) {
								c[prop] = c[prop].join(', ');
							}

							if (unit) {
								c[prop] += ` ${unit}`;
							}
						}
					}

					let desc = `${i + 1 === arr.length ? '└─' : '├─'} ${highlight(c.k)}`;
					if (c.v !== undefined) {
						if (c.o !== undefined) {
							desc += ` changed from ${highlight(`"${c.o}"`)} to ${highlight(`"${c.v}"`)}`;
						} else {
							desc += ` of ${highlight(`"${c.v}"`)} was added`;
						}
					}
					return desc;
				}).join('\n');
			}

			table.push([
				new Date(event.ts).toLocaleDateString(),
				event.message.replace(/__s__(.*?)__\/s__/g, (s, m) => highlight(m)),
				event.event,
				event.data.org_name || note('n/a')
			]);

			if (changes) {
				table.push([ '', { colSpan: 3, content: changes } ]);
			}
		}
		console.log(table.toString());
	}
};
