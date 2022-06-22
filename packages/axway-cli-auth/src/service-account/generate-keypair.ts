import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';
import { CLICommand, CLIHelpOptions } from 'cli-kit';

export default {
	desc: 'Create a pem formatted public/private key pair',
	help: {
		header(this: CLICommand) {
			return `${this.desc}.`;
		},
		footer({ style }: CLIHelpOptions): string {
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
		'--yes': 'Automatic yes to overwrite existing output files and run non-interactively',
		'--json': {
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
			desc: 'Outputs result as JSON'
		},
		'--private-key [path]': 'The file to output the private key to',
		'--public-key [path]': 'The file to output the public key to'
	},
	async action({ argv, console, terminal }: AxwayCLIState): Promise<void> {
		const { generateKeypair } = await import('../lib/keypair');

		const certs = await generateKeypair({
			force:      !!argv.yes,
			publicKey:  argv.publicKey as string,
			privateKey: argv.privateKey as string,
			silent:     !!argv.json || !terminal.stdout.isTTY
		});

		if (argv.json) {
			console.log(JSON.stringify(certs, null, 2));
		} else {
			const { default: snooplogg } = await import('snooplogg');
			const { highlight } = snooplogg.styles;
			for (const { file, label } of Object.values(certs)) {
				console.log(`Wrote ${label.toLowerCase()}: ${highlight(file)}`);
			}
		}
	}
};
