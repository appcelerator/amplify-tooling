import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';
import { ClientUpdateParams } from '@axway/amplify-sdk';
import { CLIHelpOptions } from 'cli-kit';

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
		footer({ style }: CLIHelpOptions): string {
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
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
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
	async action({ argv, cli, console }: AxwayCLIState): Promise<void> {
		const { initPlatformAccount } = await import('@axway/amplify-cli-utils');
		const { existsSync, isFile } = await import('@axway/amplify-utils');
		const { readFileSync } = await import('fs');

		const { account, org, sdk } = await initPlatformAccount(
			argv.account as string,
			argv.org as string,
			argv.env as string
		);

		if (!org.userRoles?.includes('administrator')) {
			throw new Error(`You do not have administrative access to update a service account in the "${org.name}" organization`);
		}

		const data: ClientUpdateParams = {
			client: argv.id as string
		};

		if (argv.name !== undefined) {
			data.name = argv.name as string;
		}

		if (argv.desc !== undefined) {
			data.desc = argv.desc as string;
		}

		if (argv.publicKey !== undefined) {
			if (!existsSync(argv.publicKey as string)) {
				throw new Error(`Public key ${argv.publicKey} does not exist`);
			}
			if (!isFile(argv.publicKey as string)) {
				throw new Error(`Public key ${argv.publicKey} is not a file`);
			}
			const publicKeyFile = argv.publicKey;
			data.publicKey = readFileSync(publicKeyFile as string, 'utf-8');
			if (!data.publicKey.startsWith('-----BEGIN PUBLIC KEY-----')) {
				throw new Error(`Public key ${publicKeyFile} is not a PEM formatted file`);
			}
		}

		if (argv.role !== undefined) {
			// filter out all falsey/empty roles or `true`
			// note that --role without an explicit value is set to `true`
			data.roles = (argv.role as (string | boolean)[]).filter(r => r && r !== true) as string[];
		}

		if (typeof argv.secret === 'number') {
			data.secret = String(argv.secret);
		} else if (argv.secret !== undefined) {
			data.secret = argv.secret as string;
		}

		const results = {
			...(await sdk.client.update(account, org, data)),
			account
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const { default: snooplogg } = await import('snooplogg');
			const { highlight, note } = snooplogg.styles;
			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

			const { client_id, name } = results.client;
			console.log(`Successfully updated service account ${highlight(name)} ${note(`(${client_id})`)}`);
		}

		await cli.emitAction('axway:auth:service-account:create', results);
	}
};
