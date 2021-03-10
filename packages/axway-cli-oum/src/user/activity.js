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

		const table = createTable([ 'Date', 'Description', 'Event Name', 'Organization', 'IP Address', 'Changes' ]);
		for (const event of events) {
			let changes = '';
			if (Array.isArray(event.data.changes)) {
				changes = event.data.changes.map(c => {
					const p = c.k.charAt(0).toUpperCase() + c.k.substring(1);
					return `${highlight(p)} changed from ${highlight(`"${c.o}"`)} to ${highlight(`"${c.v}"`)}`;
				}).join('\n');
			}

			table.push([
				new Date(event.ts).toLocaleDateString(),
				event.message.replace(/__s__(.*?)__\/s__/g, (s, m) => highlight(m)),
				event.event,
				event.data.org_name || note('n/a'),
				event.data.ip || note('n/a'),
				changes
			]);
		}
		console.log(table.toString());
	}
};
