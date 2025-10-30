import { initPlatformAccount } from '../../lib/utils.js';
import { isFile } from '../../lib/fs.js';
import { existsSync, readFileSync } from 'fs';
import { highlight, note } from '../../lib/logger.js';
import { Flags, Args } from '@oclif/core';
import Command from '../../lib/command.js';

export default class ServiceAccountUpdate extends Command {
	static override summary = 'Update a service account.';

	static override description = `Multiple values may be changed in a single call.

You cannot change a service account's authentication method from client secret to public key and vice versa.`;

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
		desc: Flags.string({
			description: 'The description of the service account'
		}),
		name: Flags.string({
			description: 'Friendly name to use for display'
		}),
		org: Flags.string({
			description: 'The organization name, id, or guid'
		}),
		publicKey: Flags.string({
			description: 'The path to the public key'
		}),
		role: Flags.string({
			description: 'Assign one or more organization roles to the service account',
			multiple: true
		}),
		secret: Flags.string({
			description: 'A custom client secret key'
		})
	};

	static override examples = [
		{
			description: 'Change a service account name, description, and role',
			command: '<%= config.bin %> <%= command.id %> <name/client-id> --name <new_name> --desc <desc> --role administrator'
		},
		{
			description: 'Update a service account\'s client secret key',
			command: '<%= config.bin %> <%= command.id %> <name/client-id> --secret <new_secret>'
		},
		{
			description: 'Update a service account\'s public key',
			command: '<%= config.bin %> <%= command.id %> <name/client-id> --public-key /path/to/public_key.pem'
		}
	];

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { args, flags } = await this.parse(ServiceAccountUpdate);
		const { account, org, sdk } = await initPlatformAccount(flags.account, flags.org);

		if (!account.user.roles.includes('administrator')) {
			throw new Error(`You do not have administrative access to update a service account in the "${org.name}" organization`);
		}

		const data: any = {
			client: args['client-id']
		};

		if (flags.name !== undefined) {
			data.name = flags.name;
		}

		if (flags.desc !== undefined) {
			data.desc = flags.desc;
		}

		if (flags.publicKey !== undefined) {
			if (!existsSync(flags.publicKey)) {
				throw new Error(`Public key ${flags.publicKey} does not exist`);
			}
			if (!isFile(flags.publicKey)) {
				throw new Error(`Public key ${flags.publicKey} is not a file`);
			}
			const publicKeyFile = flags.publicKey;
			data.publicKey = readFileSync(publicKeyFile, 'utf-8');
			if (!data.publicKey.startsWith('-----BEGIN PUBLIC KEY-----')) {
				throw new Error(`Public key ${publicKeyFile} is not a PKCS#8 PEM formatted file`);
			}
		}

		if (flags.role !== undefined) {
			data.roles = flags.role.filter(r => r && r !== true);
		}

		if (flags.secret !== undefined) {
			data.secret = flags.secret;
		}

		const results = await sdk.client.update(account, org, data);
		results.account = account.name;

		if (this.jsonEnabled()) {
			return results;
		}
		this.log(`Account:      ${highlight(account.name)}`);
		this.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		const { client_id, name } = results.client;
		this.log(`Successfully updated service account ${highlight(name)} ${note(`(${client_id})`)}`);
	}
}
