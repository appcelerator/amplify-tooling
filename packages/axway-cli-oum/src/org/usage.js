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
		'--json': 'Outputs accounts as JSON',
		'--to [yyyy-mm-dd]': 'The end date'
	},
	async action({ argv, console }) {
		const { initPlatformAccount } = require('../lib/util');
		const { createTable } = require('@axway/amplify-cli-utils');
		let { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);
		org = await sdk.org.find(account, org);
		const results = await sdk.org.usage(account, org.id, argv);

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
			return;
		}

		const { default: snooplogg } = require('snooplogg');
		const { gray, green, highlight, note, red, yellow } = snooplogg.styles;
		const { from, to, usage } = results;

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

		// API Calls 10,000,000 calls 0
		// Push Notifications 8,640,000 calls 0
		// File Storage 100 GB 0
		// Database Storage 100 GB <0.01
		// Container Points 4,500 points 0
		// Analytics Events 100,000,000 events

		// 	{
		// 		"usage": {
		// 		  "SaaS": {
		// 			"apiRateMonth": {
		// 			  "name": "API Calls",
		// 			  "quota": 10000000,
		// 			  "value": 0,
		// 			  "unit": "calls",
		// 			  "percent": 0,
		// 			  "envs": {}
		// 			},
		// 			"pushRateMonth": {
		// 			  "name": "Push Notifications",
		// 			  "quota": 8640000,
		// 			  "value": 0,
		// 			  "unit": "calls",
		// 			  "percent": 0,
		// 			  "envs": {}
		// 			},
		// 			"storageFilesGB": {
		// 			  "name": "File Storage",
		// 			  "quota": 100,
		// 			  "value": 0,
		// 			  "unit": "GB",
		// 			  "percent": 0,
		// 			  "envs": {}
		// 			},
		// 			"storageDatabaseGB": {
		// 			  "name": "Database Storage",
		// 			  "quota": 100,
		// 			  "value": 0.000003188,
		// 			  "unit": "GB",
		// 			  "percent": 0,
		// 			  "envs": {
		// 				"default": {
		// 				  "quota": 100,
		// 				  "value": 0.000003188,
		// 				  "production": false
		// 				}
		// 			  }
		// 			},
		// 			"containerPoints": {
		// 			  "name": "Container Points",
		// 			  "quota": 4500,
		// 			  "value": 0,
		// 			  "unit": "points",
		// 			  "percent": 0,
		// 			  "envs": {
		// 				"default": {
		// 				  "value": 0,
		// 				  "quota": 4500
		// 				}
		// 			  }
		// 			},
		// 			"eventRateMonth": {
		// 			  "name": "Analytics Events",
		// 			  "quota": 100000000,
		// 			  "value": 0,
		// 			  "unit": "events",
		// 			  "percent": 0,
		// 			  "envs": {}
		// 			}
		// 		  }
		// 		},
		// 		"limit_users": 100,
		// 		"limit_read_only_users": 3,
		// 		"users": 2,
		// 		"read_only_users": 0,
		// 		"collaborators": 0,
		// 		"apps": 1,
		// 		"apis": 3,
		// 		"apisArrow": 1,
		// 		"apisArrowDB": 2,
		// 		"ending": "2021-03-31T23:59:59.999Z",
		// 		"basis": "EOM"
		// 	  }
	}
};
