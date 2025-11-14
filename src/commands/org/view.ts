import { createTable } from '../../lib/formatter.js';
import { active, highlight, note } from '../../lib/logger.js';
import { Args } from '@oclif/core';
import Command from '../../lib/command.js';

export default class OrgView extends Command {
	static override aliases = [ 'org:info' ];

	static override summary = 'Display organization details.';

	static override description = 'Shows information about an organization, including its teams and subscriptions.';

	static override args = {
		org: Args.string({
			description: 'The organization name, id, or guid; defaults to the current org.',
			required: false
		})
	};

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { account, org } = await this.parse(OrgView);

		if (this.jsonEnabled()) {
			return {
				account: account.name,
				organization: org,
			};
		}

		this.log(`Account: ${highlight(account.name)}\n`);
		this.log('ORGANIZATION');
		this.log(`  Name:          ${highlight(org.name)}`);
		this.log(`  Org ID:        ${highlight(org.id)}`);
		this.log(`  Org GUID:      ${highlight(org.guid)}`);
		this.log(`  Date Created:  ${highlight(new Date(org.created).toLocaleString())}`);
		this.log(`  Active:        ${highlight(org.active ? 'Yes' : 'No')}`);
		this.log(`  Region:        ${highlight(org.region === 'US' ? 'United States' : org.region)}`);
		this.log(`  Users:         ${highlight(`${org.userCount} user${org.userCount !== 1 ? 's' : ''}${org.seats ? ` / ${org.seats} seat${org.seats !== 1 ? 's' : ''}` : ''}`)}`);

		const teamsTable = createTable([ '  Name', 'Description', 'GUID', 'User', 'Apps', 'Date Created' ]);
		const checkMark = process.platform === 'win32' ? '√' : '✔';
		for (const team of org.teams ?? []) {
			teamsTable.push([
				team.default ? active(`  ${checkMark} ${team.name}`) : `    ${team.name}`,
				team.desc || note('n/a'),
				team.guid,
				team.users?.length ?? 0,
				team.apps?.length ?? 0,
				new Date(team.created).toLocaleDateString(),
			]);
		}
		this.log('\nTEAMS');
		if (teamsTable.length) {
			this.log(teamsTable.toString());
		} else {
			this.log('  No teams found');
		}

		if (Array.isArray(org.subscriptions) && org.subscriptions.length) {
			const subsTable = createTable([ '  Category', 'Edition', 'Tier', 'Governance', 'Date', 'Status' ]);
			for (const sub of org.subscriptions) {
				subsTable.push([
					`  ${sub.category}`,
					sub.edition,
					sub.tier.charAt(0).toUpperCase() + sub.tier.slice(1),
					sub.governance,
					`${new Date(sub.startDate).toLocaleDateString()} - ${new Date(sub.endDate).toLocaleDateString()}`,
					sub.expired ? 'Terminated' : 'Active'
				]);
			}
			this.log('\nSUBSCRIPTIONS');
			this.log(subsTable.toString());
		}
	}
}
