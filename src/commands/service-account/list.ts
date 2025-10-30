import { initPlatformAccount } from '../../lib/utils.js';
import { createTable } from '../../lib/formatter.js';
import { highlight, note } from '../../lib/logger.js';
import { Flags } from '@oclif/core';
import Command from '../../lib/command.js';

export default class ServiceAccountList extends Command {
	static override aliases = [
		'service-account:ls'
	];

	static override summary = 'List all service accounts.';

	static override flags = {
		account: Flags.string({
			description: 'The platform account to use',
			required: false
		}),
		org: Flags.string({
			description: 'The organization name, id, or guid',
			required: false
		})
	};

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { flags } = await this.parse(ServiceAccountList);
		const { account, org, sdk } = await initPlatformAccount(flags.account, flags.org);
		const { clients } = await sdk.client.list(account, org);

		if (this.jsonEnabled()) {
			return {
				account: account.name,
				org,
				clients
			};
		}

		this.log(`Account:      ${highlight(account.name)}`);
		this.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		if (!clients.length) {
			this.log('No service accounts found');
			return;
		}

		const table = createTable([ 'Client ID', 'Name', 'Auth Method', 'Teams', 'Roles', 'Date Created' ]);

		for (const { client_id, created, method, name, roles, teams } of clients) {
			table.push([
				highlight(client_id),
				name,
				method,
				teams,
				roles?.join(', ') || 'n/a',
				new Date(created).toLocaleDateString()
			]);
		}
		this.log(table.toString());
	}
}
