import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';
import {
	CLIHelpOptions
} from 'cli-kit';

export default {
	aliases: [ '!add', '!new' ],
	desc: 'Create a service account',
	help: {
		header() {
			return `
Creates a service account. A service account requires a name and either a
client secret key or a PEM formatted public key.

The service account's client id is autogenerated by the platform based on the
provided name.

If the service account name is not specified, then the command will
interactively prompt for all values. If prompting is not available, then all
required options must be passed in at execution.`;
		},
		footer({ style }: CLIHelpOptions): string {
			return `${style.heading('Examples:')}

  Create a service account and prompt for name, type, etc:
    ${style.highlight('axway service-account create')}

  Create a service account with a auto-generated client secret key:
    ${style.highlight('axway service-account create --name foo')}

  Create a service account with a custom client secret key:
    ${style.highlight('axway service-account create --name foo --secret bar')}

  Create a service account with a PEM formatted public key:
    ${style.highlight('axway service-account create --name foo --public-key /path/to/public_key.pem')}`;
		}
	},
	options: {
		'--account [name]':     'The platform account to use',
		'--desc [value]':       'The description of the service account',
		'--json': {
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
			desc: 'Outputs result as JSON'
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
	async action({ argv, cli, console, help, terminal }: AxwayCLIState): Promise<void> {
		const { initPlatformAccount } = await import('@axway/amplify-cli-utils');
		const { existsSync, isFile }  = await import('@axway/amplify-utils');
		const { generateKeypair }     = await import('../lib/keypair');
		const { prompt }              = await import('enquirer');
		const { readFileSync }        = await import('fs');
		const { default: uuid }       = await import('uuid');
		const { default: snooplogg }  = await import('snooplogg');
		const { highlight, note }     = snooplogg.styles;

		const { account, org, sdk } = await initPlatformAccount(
			argv.account as string,
			argv.org as string,
			argv.env as string
		);

		if (!org.userRoles?.includes('administrator')) {
			throw new Error(`You do not have administrative access to create a service account in the "${org.name}" organization`);
		}

		if (!argv.json) {
			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
		}

		let {
			desc,
			name,
			publicKey,
			role: roles,
			secret
		} = argv as {
			desc: string,
			name: string,
			publicKey: string,
			role: string[],
			secret: string
		};
		let prompted = false;
		const doPrompt = (opts: any) => {
			prompted = true;
			return prompt(opts);
		};

		if (!name) {
			// if we do not have a TTY, then we can't prompt, so show the help
			if (!terminal.stdout.isTTY) {
				console.log(await help());
				return;
			}

			({ name } = await doPrompt({
				hint: 'A friendly name used for display',
				message: 'Display name',
				name: 'name',
				type: 'input',
				validate(s: string) {
					return s ? true : 'Please enter a service account name';
				}
			}) as any);
		}

		if (!desc && !argv.name) {
			({ desc } = await doPrompt({
				hint: 'Press enter to skip',
				message: 'Description',
				name: 'desc',
				type: 'input'
			}) as any);
		}

		if (typeof secret === 'number') {
			secret = String(secret);
		}

		if (!secret && !publicKey) {
			if (!terminal.stdout.isTTY) {
				throw new Error('Missing required --secret <key> or --public-key <path>');
			}

			const { type } = await doPrompt({
				choices: [
					{ message: 'Auto-generated client secret key', value: 'auto' },
					{ message: 'Custom client secret key', value: 'secret' },
					{ message: 'Specify PEM formatted public key file', value: 'publicKey' },
					{ message: 'Generate a new public/private key pair', value: 'generate' }
				],
				message: 'Authentication method',
				name: 'type',
				type: 'select'
			}) as any;

			if (type === 'auto') {
				secret = uuid.v4();
			} else if (type === 'secret') {
				({ secret } = await doPrompt({
					message: 'Secret key',
					name: 'secret',
					type: 'password',
					validate(s: string) {
						return s ? true : 'Please enter a client secret key';
					}
				}) as any);
			} else if (type === 'publicKey') {
				({ publicKey } = await doPrompt({
					message: 'Public key file path',
					name: 'publicKey',
					type: 'input',
					validate(s: string) {
						if (!s) {
							return 'Please enter the path to the PEM formatted public key file';
						}
						if (!isFile(s)) {
							return 'Specified file does not exist';
						}
						if (!readFileSync(s, 'utf-8').startsWith('-----BEGIN PUBLIC KEY-----')) {
							return 'Specified file is not in the PEM format';
						}
						return true;
					}
				}) as any);
			} else if (type === 'generate') {
				const certs = await generateKeypair({
					silent: !!argv.json || !terminal.stdout.isTTY
				});

				publicKey = certs.publicKey?.file as string;
			}
		}

		if (!roles.length && !argv.name) {
			const availableRoles = await sdk.role.list(account, { client: true, org });
			({ roles } = await doPrompt({
				choices: availableRoles.map(role => ({ name: role.name })),
				hint: 'Use ↑ and ↓ then \'space\' to select one or more roles',
				message: 'Roles',
				name: 'roles',
				type: 'multiselect'
			}) as any);
		}

		// validate the public key
		if (publicKey) {
			if (!existsSync(publicKey)) {
				throw new Error(`Public key ${publicKey} does not exist`);
			}
			if (!isFile(publicKey)) {
				throw new Error(`Public key ${publicKey} is not a file`);
			}
			const publicKeyFile = publicKey;
			publicKey = readFileSync(publicKeyFile, 'utf-8');
			if (!publicKey.startsWith('-----BEGIN PUBLIC KEY-----')) {
				throw new Error(`Public key ${publicKeyFile} is not a PEM formatted file`);
			}
		}

		const { client } = await sdk.client.create(account, org, {
			desc,
			name,
			publicKey,
			secret,
			roles
		});
		const results = {
			client: {
				...client,
				secret
			},
			org,
			account
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			if (prompted) {
				console.log();
			}

			const { client_id } = client;
			console.log('Successfully created service account\n');

			if (secret) {
				console.log(`Client ID:         ${highlight(client_id)}`);
				console.log(`Client Secret Key: ${highlight(secret)}\n`);
				console.log('Please record the secret key in a safe place.');
			} else {
				console.log(`Client ID: ${highlight(client_id)}`);
			}
		}

		await cli.emitAction('axway:auth:service-account:create', results);
	}
};
