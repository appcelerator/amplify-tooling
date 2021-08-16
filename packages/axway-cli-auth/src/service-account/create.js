export default {
	aliases: [ '!add', '!new' ],
	desc: 'Creates a service account',
	help: {
		header() {
			return `${this.desc}.`;
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
		'--team [guid|name]': {
			desc: 'Assign one or more teams to the service account',
			multiple: true,
			redact: false
		}
	},
	async action({ argv, console, terminal }) {
		const { initPlatformAccount } = require('@axway/amplify-cli-utils');
		const { existsSync, isFile } = require('appcd-fs');
		const { generateKeypair } = require('../lib/keypair');
		const { prompt } = require('enquirer');
		const { readFileSync } = require('fs');
		const uuid = require('uuid');

		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);

		if (!org.userRoles.includes('administrator')) {
			throw new Error(`You do not have administrative access to create a service account in the "${org.name}" organization`);
		}

		let {
			clientId,
			desc,
			name,
			publicKey,
			role: roles,
			secret,
			team: teams
		} = argv;

		if (!name) {
			({ name } = await prompt({
				hint: 'A friendly name used for display',
				message: 'Display name',
				name: 'name',
				type: 'input',
				validate(s) {
					return s ? true : 'Please enter a service account name';
				}
			}));
		}

		// if --name is not present, then we assume we are prompting for all fields
		if (!argv.name) {
			if (!clientId) {
				({ clientId } = await prompt({
					hint: 'A unique id for this service account',
					initial: `${name}_${uuid.v4()}`,
					message: 'Client ID',
					name: 'clientId',
					type: 'input',
					validate(s) {
						return s ? true : 'Please enter a Client ID';
					}
				}));
			}

			if (!desc) {
				({ desc } = await prompt({
					hint: 'Press enter to skip',
					message: 'Description',
					name: 'desc',
					type: 'input'
				}));
			}

			if (!secret && !publicKey) {
				const { type } = await prompt({
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
					({ secret } = await prompt({
						message: 'Secret key',
						name: 'secret',
						type: 'password',
						validate(s) {
							return s ? true : 'Please enter a client secret key';
						}
					}));
				} else if (type === 'publicKey') {
					({ publicKey } = await prompt({
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

			if (!roles.length) {
				const availableRoles = await sdk.role.list(account, { client: true, org });
				({ roles } = await prompt({
					choices: availableRoles.map(role => ({ name: role.name })),
					hint: 'Use ↑ and ↓ then \'space\' to select one or more roles',
					message: 'Roles',
					name: 'roles',
					type: 'multiselect'
				}));
			}

			if (!teams.length) {
				const { teams: availableTeams } = await sdk.team.list(account, org);
				({ teams } = await prompt({
					choices: availableTeams.map(team => ({ name: team.name, value: team.guid })),
					hint: 'Use ↑ and ↓ then \'space\' to select one or more teams',
					message: 'Teams',
					name: 'teams',
					type: 'multiselect'
				}));
			}
		}

		// validate the public key
		if (publicKey) {
			if (!existsSync(publicKey)) {
				throw new Error(`Public key file "${publicKey} does not exist`);
			}
			if (!isFile(publicKey)) {
				throw new Error(`Public key file "${publicKey}" is not a file`);
			}
			publicKey = readFileSync(publicKey, 'utf-8');
			if (!publicKey.startsWith('-----BEGIN PUBLIC KEY-----')) {
				throw new Error(`Public key file "${publicKey}" is not a PEM formatted file`);
			}
		} else if (!secret) {
			throw new Error('Must specify a --secret or --public-key');
		}

		const results = await sdk.serviceAccount.create(account, org, {
			clientId,
			desc,
			name,
			publicKey,
			secret,
			roles,
			teams
		});

		results.account = account.name;

		/*
		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const { default: snooplogg } = require('snooplogg');
			const { highlight, note } = snooplogg.styles;
			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

			// console.log(`Successfully created service account ${highlight(serviceAccount.name)} ${note(`(${serviceAccount.client_id})`)}`);
		}

		await cli.emitAction('axway:auth:service-account:create', results);
		*/
	}
};
