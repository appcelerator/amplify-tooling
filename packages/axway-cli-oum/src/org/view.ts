import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';

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
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
			desc: 'Outputs organization info as JSON'
		}
	},
	async action({ argv, console }: AxwayCLIState): Promise<void> {
		const { createTable, initPlatformAccount } = await import('@axway/amplify-cli-utils');
		const { account, org } = await initPlatformAccount(argv.account as string, argv.org as string, argv.env as string);

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				...org
			}, null, 2));
			return;
		}

		const { default: snooplogg } = await import('snooplogg');
		const { green, highlight, note } = snooplogg.styles;

		console.log(`Account: ${highlight(account.name)}\n`);

		console.log('ORGANIZATION');
		console.log(`  Name:          ${highlight(org.name)}`);
		console.log(`  Org ID:        ${highlight(org.org_id)}`);
		console.log(`  Org GUID:      ${highlight(org.guid)}`);
		console.log(`  Date Created:  ${highlight(org.created ? new Date(org.created).toLocaleString() : 'n/a')}`);
		console.log(`  Active:        ${highlight(org.active ? 'Yes' : 'No')}`);
		console.log(`  Region:        ${highlight(org.region === 'US' ? 'United States' : org.region)}`);
		console.log(`  Users:         ${highlight(`${org.userCount} user${org.userCount !== 1 ? 's' : ''}${org.seats ? ` / ${org.seats} seat${org.seats !== 1 ? 's' : ''}` : ''}`)}`);
		if (org.insightUserCount) {
			console.log(`  Insight Users: ${highlight(`${org.insightUserCount} user${org.insightUserCount !== 1 ? 's' : ''}`)}`);
		}

		const teams = createTable([ '  Name', 'Description', 'GUID', 'User', 'Apps', 'Date Created' ]);
		const check = process.platform === 'win32' ? '√' : '✔';
		for (const { apps, created, default: def, desc, guid, name, users } of org.teams) {
			teams.push([
				def ? green(`  ${check} ${name}`) : `    ${name}`,
				desc || note('n/a'),
				guid,
				users.length,
				apps.length,
				new Date(created).toLocaleDateString()
			]);
		}
		console.log('\nTEAMS');
		if (teams.length) {
			console.log(teams.toString());
		} else {
			console.log('  No teams found');
		}

		if (Array.isArray(org.subscriptions) && org.subscriptions.length) {
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
		}
	}
};
