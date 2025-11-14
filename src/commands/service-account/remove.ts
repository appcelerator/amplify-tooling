import { highlight, note } from '../../lib/logger.js';
import { Args, Flags } from '@oclif/core';
import Command from '../../lib/command.js';

export default class ServiceAccountRemove extends Command {
	static override aliases = [
		'service-account:rm',
	];

	static override summary = 'Remove a service account.';

	static override description = 'You must have administrative access to perform this operation.';

	static override args = {
		'client-id': Args.string({
			description: 'The service account client id or name',
			required: true,
		}),
	};

	static override flags = {
		org: Flags.string({
			description: 'The organization name, id, or guid; defaults to the current org.',
		}),
	};

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { args, account, org, sdk } = await this.parse(ServiceAccountRemove);

		if (!account.user.roles.includes('administrator')) {
			throw new Error(`You do not have administrative access to remove a service account in the "${org.name}" organization`);
		}

		const { client } = await sdk.client.remove(account, org, args['client-id']);
		const results = {
			account: account.name,
			org,
			client,
		};

		if (this.jsonEnabled()) {
			return results;
		}

		this.log(`Account:      ${highlight(account.name)}`);
		this.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		const { client_id, name } = results.client;
		this.log(`Successfully removed service account ${highlight(name)} ${note(`(${client_id})`)}`);
	}
}
