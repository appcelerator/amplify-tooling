export default {
	aliases: [ 'v', '!info' ],
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid; defaults to the current org'
		}
	],
	desc: 'View organization details',
	options: {
		'--account [name]': 'The account to use',
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		const { createTable, initSDK } = require('@axway/amplify-cli-utils');
		const { default: snooplogg } = require('snooplogg');
		const { highlight, note } = snooplogg.styles;
		const { config, sdk } = initSDK();

		const account = await sdk.auth.find(argv.account || config.get('auth.defaultAccount'));
		if (!account || !account.isPlatform) {
			throw new Error('You must me logged into a platform account\n\nTo login, run: axway auth login');
		}

		const orgId = argv.org || config.get(`auth.defaultOrg.${account.hash}`);
		const found = account.orgs.find(o => o.guid === orgId || o.id === orgId || o.name === orgId);
		if (!found) {
			throw new Error(`Unable to find an organization "${orgId}"`);
		}
		const org = await sdk.org.get(account, found.id);

		if (argv.json) {
			console.log(JSON.stringify(org, null, 2));
			return;
		}

		console.log(`Account: ${highlight(account.name)}\n`);

		const memberCount = org.members.length;

		console.log('ORGANIZATION');
		console.log(`  Name:            ${highlight(org.name)}`);
		console.log(`  Org ID:          ${highlight(org.id)}`);
		console.log(`  Org GUID:        ${highlight(org.guid)}`);
		console.log(`  Date Created:    ${highlight(new Date(org.created).toLocaleString())}`);
		if (org.parentOrg) {
			console.log(`  Parent Org:      ${highlight(org.parentOrg.name)} ${note(`(${org.parentOrg.id})`)}`);
		}
		console.log(`  Active:          ${highlight(org.active ? 'Yes' : 'No')}`);
		console.log(`  Region:          ${highlight(org.region === 'US' ? 'United States' : org.region)}`);
		console.log(`  Dashboard Users: ${highlight(`${memberCount} user${memberCount !== 1 ? 's' : ''}${org.seats ? ` / ${org.seats} seat${org.seats !== 1 ? 's' : ''}` : ''}`)}`);
		if (org.insightUserCount) {
			console.log(`  Insight Users:   ${highlight(`${org.insightUserCount} user${org.insightUserCount !== 1 ? 's' : ''}`)}`);
		}

		const subs = createTable([ '  Category', 'Edition', 'Tier', 'Governance', 'Date', 'Status' ]);
		for (const s of org.subscriptions) {
			subs.push([
				`  ${s.product}`,
				s.plan,
				s.tier,
				s.governance,
				`${new Date(s.startDate).toLocaleDateString()} - ${new Date(s.endDate).toLocaleDateString()}`,
				s.expired ? 'Terminated' : 'Active'
			]);
		}
		console.log('\nSUBSCRIPTIONS');
		console.log(subs.toString());

		console.log('\nMEMBERS');

		console.log('\nTEAMS');

		if (org.childOrgs) {
			const children = createTable([ '  Name', 'ID', 'Date Created', 'Status', 'Member Count' ]);
			for (const o of org.childOrgs) {
				children.push([
					`  ${o.name}`,
					o.org_id,
					new Date(o.created).toLocaleDateString(),
					o.active ? 'Active' : 'Inactive',
					o.users.length
				]);
			}
			console.log('\nCHILD ORGS');
			console.log(children.toString());
			// name, date created, status, member count
		}

		/*
		{
  users: [
    {
      guid: 'b29aaa81a709000deb368e7471192c0d',
      roles: [Array],
      primary: true
    },
    { guid: 'b052046c-9a4c-4dd7-ac1d-778bf162f701', roles: [Array] },
    { guid: 'bfe4d159-b3a6-4a17-a304-51c152ddf618', roles: [Array] },
    { guid: '114740d05b4ca309776ba80694b43557', roles: [Array] },
    { guid: '5865794f-5139-48fc-a452-310c8c0c00fd', roles: [Array] },
    { guid: 'ebee0008-9aad-4862-b6f4-1285fbcf154e', roles: [Array] },
    { guid: '545d32d1-5927-4291-9d90-8dd7c86e5075', roles: [Array] },
    { guid: '976afe48-e09a-4f24-8425-40be1ff749e2', roles: [Array] },
    { guid: 'a6cea745-635e-472f-b952-97630ea0e12d', roles: [Array] },
    { guid: '241cc006-0c55-437e-bd35-cb040964d71c', roles: [Array] },
    { guid: 'c9b2a6b1-e167-4827-bcbe-3db69813bf81', roles: [Array] },
    { guid: 'c64df447-4f40-4ec5-be97-ccfd564e6187', roles: [Array] },
    { guid: '0616f96b-c9bc-4286-9507-46df1eef45c9', roles: [Array] }
  ],
	*/
	}
};
