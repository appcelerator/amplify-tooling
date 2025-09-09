import { initPlatformAccount } from '../../lib/cli-utils/index.js';
import { existsSync, isFile } from '../../lib/utils/fs.js';
import { readFileSync } from 'fs';
import snooplogg from 'snooplogg';

export default {
	args: [
		{
			desc: 'The service account client id or name',
			hint: 'client-id/name',
			name: 'id',
			required: true
		}
	],
	desc: 'Update a service account',
	help: {
		header() {
			return `
Update service account information. Multiple values may be changed in a single
call.

You cannot change a service account's authentication method from client secret
to public key and vice versa.`;
		},
		footer({ style }) {
			return `${style.heading('Examples:')}

  Change a service account name, description, and role:
    ${style.highlight('axway service-account update <name/client-id> --name <new_name> --desc <desc> --role administrator')}

  Update a service account's client secret key:
    ${style.highlight('axway service-account update <name/client-id> --secret <new_secret>')}

  Update a service account's public key:
    ${style.highlight('axway service-account update <name/client-id> --public-key /path/to/public_key.pem')}`;
		}
	},
	options: {
		'--account [name]':     'The platform account to use',
		'--desc [value]':       'The description of the service account',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs service account as JSON'
		},
		'--name [value]':       'Friendly name to use for display',
		'--org [name|id|guid]': 'The organization name, id, or guid',
		'--public-key [path]':  'The path to the public key',
		'--role [role]': {
			desc: 'Assign one or more organization roles to the service account',
			multiple: true,
			redact: false
		},
		'--secret [key]':       'A custom client secret key'
	},
	async action({ argv, cli, console }) {
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org, argv.env);

		if (!org.userRoles.includes('administrator')) {
			throw new Error(`You do not have administrative access to update a service account in the "${org.name}" organization`);
		}

		const data: any = {
			client: argv.id
		};

		if (argv.name !== undefined) {
			data.name = argv.name;
		}

		if (argv.desc !== undefined) {
			data.desc = argv.desc;
		}

		if (argv.publicKey !== undefined) {
			if (!existsSync(argv.publicKey)) {
				throw new Error(`Public key ${argv.publicKey} does not exist`);
			}
			if (!isFile(argv.publicKey)) {
				throw new Error(`Public key ${argv.publicKey} is not a file`);
			}
			const publicKeyFile = argv.publicKey;
			data.publicKey = readFileSync(publicKeyFile, 'utf-8');
			if (!data.publicKey.startsWith('-----BEGIN PUBLIC KEY-----')) {
				throw new Error(`Public key ${publicKeyFile} is not a PEM formatted file`);
			}
		}

		if (argv.role !== undefined) {
			// filter out all falsey/empty roles or `true`
			data.roles = argv.role.filter(r => r && r !== true);
		}

		if (argv.secret !== undefined) {
			data.secret = argv.secret;
		}

		const results = await sdk.client.update(account, org, data);
		results.account = account.name;

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const { highlight, note } = snooplogg.styles;
			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

			const { client_id, name } = results.client;
			console.log(`Successfully updated service account ${highlight(name)} ${note(`(${client_id})`)}`);
		}

		await cli.emitAction('axway:auth:service-account:create', results);
	}
};
