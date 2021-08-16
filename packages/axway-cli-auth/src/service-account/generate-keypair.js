export default {
	desc: 'Create a pem formatted public/private key pair',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer({ style }) {
			return `${style.heading('Examples:')}

  Create a keypair and be prompted for the output filenames:
    ${style.highlight('axway service-account generate-keypair')}

  Create a keypair and use the default output filenames and overwrite existing files:
    ${style.highlight('axway service-account generate-keypair --yes')}

  Create a keypair and write the files using specific names:
    ${style.highlight('axway service-account generate-keypair --public-key public.pem --private-key private.pem')}

  Create a keypair and output to screen as JSON instead of writing to files:
    ${style.highlight('axway service-account generate-keypair --json')}

  Create a keypair and output to screen as JSON and write them to files:
    ${style.highlight('axway service-account generate-keypair --json --yes')}`;
		}
	},
	options: {
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs result as JSON'
		},
		'--private-key [path]': 'The file to output the private key to',
		'--public-key [path]': 'The file to output the public key to',
		'-y, --yes': 'Defaults all overwrite prompts to yes'
	},
	async action({ argv, console, terminal }) {
		const { existsSync, writeFileSync } = require('appcd-fs');
		const { initSDK } = require('@axway/amplify-cli-utils');
		const { prompt } = require('enquirer');
		const { resolve } = require('path');
		const { default: snooplogg } = require('snooplogg');

		const { highlight } = snooplogg.styles;
		const { sdk } = initSDK();
		const certs = await sdk.serviceAccount.generateKeyPair();
		const files = {};
		let space = false;

		const check = async ({ initial, label, type }) => {
			let file = argv[type];

			if (!file && argv.yes) {
				file = initial;
			} else if (terminal.stdout.isTTY && !argv.json) {
				({ file } = await prompt({
					initial,
					message: `${label} output file`,
					name: 'file',
					type: 'input',
					validate(s) {
						return s ? true : `Please enter the ${label.toLowerCase()} output file`;
					}
				}));
				space = true;
			} else {
				return;
			}

			let resolvedFile = resolve(file);

			if (existsSync(resolvedFile) && terminal.stdout.isTTY && !argv.yes && !argv.json) {
				const { overwrite } = await prompt({
					message: `"${file}" already exists, overwrite?`,
					name: 'overwrite',
					type: 'confirm'
				});
				if (!overwrite) {
					resolvedFile = false;
				}
				space = type === 'publicKey';
			}

			files[type] = resolvedFile;
		};

		// validate the files
		await check({
			initial: 'private_key.pem',
			label: 'Private key',
			type: 'privateKey'
		});

		await check({
			initial: 'public_key.pem',
			label: 'Public key',
			type: 'publicKey'
		});

		if (!argv.json) {
			if (!files.publicKey && !files.privateKey) {
				return;
			}
			if (space) {
				console.log();
			}
		}

		// write the files
		for (const type of Object.keys(files)) {
			if (files[type]) {
				writeFileSync(files[type], certs[type]);
				if (!argv.json) {
					console.log(`Wrote ${type === 'publicKey' ? 'public' : 'private'} key: ${highlight(files[type])}`);
				}
			}
		}

		if (argv.json) {
			console.log(certs);
		}
	}
};
