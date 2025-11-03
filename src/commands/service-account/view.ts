import { initPlatformAccount } from '../../lib/utils.js';
import { createTable } from '../../lib/formatter.js';
import { highlight, note } from '../../lib/logger.js';
import { Args, Flags } from '@oclif/core';
import Command from '../../lib/command.js';

export default class ServiceAccountView extends Command {
	static override aliases = [
		'service-account:v',
		'service-account:info',
		'service-account:show'
	];

	static override summary = 'View service account details.';

	static override description = 'Displays information about a service account, including its roles, teams, and authentication method.';

	static override args = {
		'client-id': Args.string({
			description: 'The service account client id or name',
			required: true
		})
	};

	static override flags = {
		account: Flags.string({
			description: 'The platform account to use'
		}),
		org: Flags.string({
			description: 'The organization name, id, or guid'
		})
	};

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { args, flags } = await this.parse(ServiceAccountView);
		const { account, org, sdk } = await initPlatformAccount(flags.account, flags.org);
		const result = await sdk.client.find(account, org, args['client-id']);

		if (this.jsonEnabled()) {
			return result;
		}

		const { client } = result;

		this.log(`Account:      ${highlight(account.name)}`);
		this.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		if (!client) {
			this.log(`Service account "${args.id}" not found`);
			return;
		}

		this.log('SERVICE ACCOUNT');
		this.log(`  Name:         ${highlight(client.name)}`);
		this.log(`  Client ID:    ${highlight(client.client_id)}`);
		this.log(`  Description:  ${client.description ? highlight(client.description) : note('n/a')}`);
		this.log(`  Date Created: ${client.created ? highlight(new Date(client.created).toLocaleString()) : note('n/a')}`);

		this.log('\nAUTHENTICATION');
		this.log(`  Method:       ${highlight(client.method)}`);

		this.log('\nORG ROLES');
		if (client.roles.length) {
			for (const role of client.roles) {
				this.log(`  ${role}`);
			}
		} else {
			this.log('  No roles found');
		}

		this.log('\nTEAMS');
		if (client.teams.length) {
			const table = createTable([ '  Name', 'Role', 'Description', 'Team GUID', 'User', 'Apps', 'Date Created' ]);
			for (const { apps, created, desc, guid, name, roles, users } of client.teams) {
				table.push([
					`  ${name}`,
					roles.join(', '),
					desc || '',
					guid,
					users?.length || 0,
					apps?.length || 0,
					new Date(created).toLocaleDateString()
				]);
			}
			this.log(table.toString());
		} else {
			this.log('  No teams found');
		}
	}
};
