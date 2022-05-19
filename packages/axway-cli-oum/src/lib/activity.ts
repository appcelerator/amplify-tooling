/**
 * Renders org and user activity results.
 *
 * @param {Object} params - Various parameters.
 * @param {Object} params.account - The account the activity is for.
 * @param {Object} params.console - The console instance to write the output to.
 * @param {Boolean} [params.json] - When `true`, outputs the results as JSON.
 * @param {Array.<Object>} params.results - The list of activity events.
 * @returns {Promise}
 */
export async function renderActivity({ account, console, json, results }) {
	if (json) {
		console.log(JSON.stringify(results, null, 2));
		return;
	}

	const { createTable } = require('@axway/amplify-cli-utils');
	const { default: snooplogg } = require('snooplogg');
	const { highlight, note } = snooplogg.styles;
	let { from, to, events } = results;

	const formatDate = d => {
		const dt = d ? new Date(d) : new Date();
		return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}/${dt.getUTCFullYear()}`;
	};

	console.log(`Account:      ${highlight(account.name)}`);
	if (results.org) {
		console.log(`Organization: ${highlight(results.org.name)} ${note(`(${results.org.guid})`)}`);
	}
	console.log(`Date Range:   ${highlight(formatDate(from))} - ${highlight(formatDate(to))}\n`);

	if (!events.length) {
		console.log('No activity found');
		return;
	}

	const table = createTable([ 'Date', 'Description', 'Event Name', 'Organization' ]);
	for (const event of events) {
		let changes = '';
		if (event.data && Array.isArray(event.data.changes)) {
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

				if (c.v === true || c.v === false) {
					desc += ` was ${c.v ? 'enabled' : 'disabled'}`;
				} else if (c.o !== undefined && c.v !== undefined) {
					desc += ` changed from ${highlight(`"${c.o}"`)} to ${highlight(`"${c.v}"`)}`;
				} else if (c.v !== undefined) {
					desc += ` of ${highlight(`"${c.v}"`)} was added`;
				} else {
					desc += ` of ${highlight(`"${c.o}"`)} was removed`;
				}

				return desc;
			}).join('\n');
		}

		table.push([
			formatDate(event.ts),
			event.message.replace(/__s__(.*?)__\/s__/g, (s, m) => highlight(m)),
			event.event,
			event.data?.org_name || note('n/a')
		]);

		if (changes) {
			table.push([ '', { colSpan: 3, content: changes } ]);
		}
	}
	console.log(table.toString());
}
