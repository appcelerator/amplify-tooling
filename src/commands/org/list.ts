import { createTable } from '../../lib/formatter.js';
import { active, highlight } from '../../lib/logger.js';
import Command from '../../lib/command.js';

export default class OrgList extends Command {
	static override aliases = [
		'org:ls'
	];

	static override summary = 'List organizations.';

	static override examples = [
		{
			description: 'List organizations for the default account',
			command: '<%= config.bin %> <%= command.id %>'
		},
		{
			description: 'List organizations for a specific account',
			command: '<%= config.bin %> <%= command.id %> --account my-account'
		},
		{
			description: 'Output organizations as JSON',
			command: '<%= config.bin %> <%= command.id %> --json'
		}
	];

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { account, org } = await this.parse(OrgList);

		if (this.jsonEnabled()) {
			return {
				account: account.name,
				orgs: [ org ]
			};
		}

		this.log(`Account: ${highlight(account.name)}\n`);

		if (!org) {
			return this.log('No organizations found');
		}

		const table = createTable([ 'Organization', 'GUID', 'ORG ID' ]);
		const check = process.platform === 'win32' ? '√' : '✔';

		table.push([
			active(`${check} ${org.name}`),
			org.guid,
			org.id
		]);
		this.log(table.toString());
	}
}
