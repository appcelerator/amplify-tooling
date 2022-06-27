import { Account, ActivityChange, ActivityEvent, OrgRef } from '@axway/amplify-sdk';

interface ExActivityChange extends ActivityChange {
	[key: string]: boolean | number | string | string[] | undefined;
}

export interface RenderActivityOptions {
	account: Account,
	console: Console,
	events: ActivityEvent[],
	from: Date,
	json: boolean,
	org?: OrgRef,
	to: Date
}

/**
 * Renders org and user activity results.
 *
 * @param {Object} params - Various parameters.
 * @param {Object} params.account - The account the activity is for.
 * @param {Object} params.console - The console instance to write the output to.
 * @param {Array.<Object>} params.events - The list of activity events.
 * @param {Date} params.from - The date range starting date.
 * @param {Boolean} [params.json] - When `true`, outputs the results as JSON.
 * @param {Object} [params.org] The organization info, if applicable.
 * @param {Date} params.to - The date range ending date.
 * @returns {Promise}
 */
export async function renderActivity({ account, console, events, from, json, org, to }: RenderActivityOptions) {
	if (json) {
		console.log(JSON.stringify({
			account,
			org,
			from,
			to,
			events
		}, null, 2));
		return;
	}

	const { createTable } = await import('@axway/amplify-cli-utils');
	const { default: snooplogg } = await import('snooplogg');
	const { highlight, note } = snooplogg.styles;

	const formatDate = (dt: Date | number): string => {
		if (!(dt instanceof Date)) {
			dt = new Date(dt);
		}
		return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}/${dt.getUTCFullYear()}`;
	};

	console.log(`Account:      ${highlight(account.name)}`);
	if (org) {
		console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}`);
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
			const t = (str: string): string => str.toLowerCase().replace(/(?:^|\s|-)\S/g, c => c.toUpperCase());
			changes = event.data.changes.map((change, i, arr) => {
				const c: ExActivityChange = { ...change };
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
						const d = new Date(c[prop] as string);
						if (!isNaN(d.valueOf())) {
							c[prop] = d.toLocaleDateString();
							continue;
						}

						if (Array.isArray(c[prop])) {
							c[prop] = (c[prop] as string[]).join(', ');
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
