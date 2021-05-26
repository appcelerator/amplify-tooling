export default {
	aliases: [ '!info' ],
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid; defaults to the current org'
		}
	],
	desc: 'View organization information',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs organization info as JSON'
		}
	},
	async action({ argv, console }) {
		const { createTable } = require('@axway/amplify-cli-utils');
		const { initPlatformAccount } = require('../lib/util');
		let { account, org } = await initPlatformAccount(argv.account, argv.org);

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				...org
			}, null, 2));
			return;
		}

		const { default: snooplogg } = require('snooplogg');
		const { highlight, note } = snooplogg.styles;

		console.log(`Account: ${highlight(account.name)}\n`);

		console.log('ORGANIZATION');
		console.log(`  Name:          ${highlight(org.name)}`);
		console.log(`  Org ID:        ${highlight(org.id)}`);
		console.log(`  Org GUID:      ${highlight(org.guid)}`);
		console.log(`  Date Created:  ${highlight(new Date(org.created).toLocaleString())}`);
		if (org.parentOrg) {
			console.log(`  Parent Org:    ${highlight(org.parentOrg.name)} ${note(`(${org.parentOrg.id})`)}`);
		}
		console.log(`  Active:        ${highlight(org.active ? 'Yes' : 'No')}`);
		console.log(`  Region:        ${highlight(org.region === 'US' ? 'United States' : org.region)}`);
		console.log(`  Users:         ${highlight(`${org.userCount} user${org.userCount !== 1 ? 's' : ''}${org.seats ? ` / ${org.seats} seat${org.seats !== 1 ? 's' : ''}` : ''}`)}`);
		if (org.insightUserCount) {
			console.log(`  Insight Users: ${highlight(`${org.insightUserCount} user${org.insightUserCount !== 1 ? 's' : ''}`)}`);
		}
		console.log(`  Teams:         ${highlight(org.teamCount)}`);

		const subs = createTable([ '  Category', 'Edition', 'Tier', 'Governance', 'Date', 'Status' ]);
		for (const s of org.subscriptions) {
			subs.push([
				`  ${s.category}`,
				s.edition,
				s.tier.charAt(0).toUpperCase() + s.tier.slice(1),
				s.governance,
				`${new Date(s.startDate).toLocaleDateString()} - ${new Date(s.endDate).toLocaleDateString()}`,
				s.expired ? 'Terminated' : 'Active'
			]);
		}
		console.log('\nSUBSCRIPTIONS');
		console.log(subs.toString());

		if (Array.isArray(org.childOrgs) && org.childOrgs.length) {
			const children = createTable([ '  Name', 'GUID', 'Date Created', 'Status', 'Users' ]);
			for (const o of org.childOrgs) {
				children.push([
					`  ${o.name}`,
					o.guid,
					new Date(o.created).toLocaleDateString(),
					o.active ? 'Active' : 'Inactive',
					o.userCount
				]);
			}
			console.log('\nCHILD ORGS');
			console.log(children.toString());
		}
	}
};
