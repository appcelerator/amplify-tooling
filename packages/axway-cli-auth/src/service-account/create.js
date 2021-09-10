export default {
	aliases: [ '!add', '!new' ],
	desc: 'Create a service account',
	help: {
		header() {
			return `
Creates a service account. A service account requires a name and either a
client secret key or a PEM formatted public key.

The client id defaults to the specified service account name plus a uuid. You
can override this and specify your own client id, however the client id cannot
begin with "AASA", "CASA", "DOSA", or "MASA".

If the service account name is not specified, then the command will
interactively prompt for all values. If prompting is not available, then all
required options must be passed in at execution.`;
		},
		footer({ style }) {
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
		'--client-id [id]':     'The service account client id',
		'--desc [value]':       'The description of the service account',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
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
	async action({ argv, cli, console, help, terminal }) {
		const { initPlatformAccount } = require('@axway/amplify-cli-utils');
		const { existsSync, isFile } = require('appcd-fs');
		const { generateKeypair } = require('../lib/keypair');
		const { prompt } = require('enquirer');
		const { readFileSync } = require('fs');
		const uuid = require('uuid');

		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org, argv.env);

		if (!org.userRoles.includes('administrator')) {
			throw new Error(`You do not have administrative access to create a service account in the "${org.name}" organization`);
		}

		let {
			clientId,
			desc,
			name,
			publicKey,
			role: roles,
			secret
		} = argv;
		let prompted = false;
		const doPrompt = opts => {
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
				validate(s) {
					return s ? true : 'Please enter a service account name';
				}
			}));
		}

		if (!clientId) {
			clientId = `${name}_${uuid.v4()}`;

			if (!argv.name) {
				({ clientId } = await doPrompt({
					hint: 'A unique id for this service account',
					initial: clientId,
					message: 'Client ID',
					name: 'clientId',
					type: 'input',
					validate(s) {
						return s ? true : 'Please enter a Client ID';
					}
				}));
			}
		}

		if (!desc && !argv.name) {
			({ desc } = await doPrompt({
				hint: 'Press enter to skip',
				message: 'Description',
				name: 'desc',
				type: 'input'
			}));
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
			});

			if (type === 'auto') {
				secret = uuid.v4();
			} else if (type === 'secret') {
				({ secret } = await doPrompt({
					message: 'Secret key',
					name: 'secret',
					type: 'password',
					validate(s) {
						return s ? true : 'Please enter a client secret key';
					}
				}));
			} else if (type === 'publicKey') {
				({ publicKey } = await doPrompt({
					message: 'Public key file path',
					name: 'publicKey',
					type: 'input',
					validate(s) {
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
				}));
			} else if (type === 'generate') {
				const certs = await generateKeypair({
					console,
					silent: argv.json || !terminal.stdout.isTTY
				});

				publicKey = certs.publicKey.file;
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
			}));
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

		const results = await sdk.client.create(account, org, {
			clientId,
			desc,
			name,
			publicKey,
			secret,
			roles
		});
		results.account = account.name;

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const { default: snooplogg } = require('snooplogg');
			const { highlight, note } = snooplogg.styles;
			if (prompted) {
				console.log();
			}
			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

			const { client_id, name } = results.client;
			console.log(`Successfully created service account ${highlight(name)} ${note(`(${client_id})`)}`);
		}

		await cli.emitAction('axway:auth:service-account:create', results);
	}
};
