import { generateKeypair } from '../../lib/auth/keypair.js';
import { highlight } from '../../lib/logger.js';
import { Flags } from '@oclif/core';
import Command from '../../lib/command.js';

export default class GenerateKeypair extends Command {
	static override summary = 'Create a pem formatted public/private key pair.';

	static override flags = {
		yes: Flags.boolean({
			description: 'Automatic yes to overwrite existing output files',
			default: false
		}),
		'private-key': Flags.string({
			description: 'The file to output the private key to'
		}),
		'public-key': Flags.string({
			description: 'The file to output the public key to'
		})
	};

	static override examples = [
		{
			description: 'Create a keypair and be prompted for the output filenames',
			command: '<%= config.bin %> <%= command.id %>'
		},
		{
			description: 'Create a keypair and use the default output filenames and overwrite existing files',
			command: '<%= config.bin %> <%= command.id %> --yes'
		},
		{
			description: 'Create a keypair and write the files using specific names',
			command: '<%= config.bin %> <%= command.id %> --public-key public.pem --private-key private.pem'
		},
		{
			description: 'Create a keypair and output to screen as JSON instead of writing to files',
			command: '<%= config.bin %> <%= command.id %> --json'
		},
		{
			description: 'Create a keypair and output to screen as JSON and write them to files',
			command: '<%= config.bin %> <%= command.id %> --json --yes'
		}
	];

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { flags } = await this.parse(GenerateKeypair);
		const certs = await generateKeypair({
			console,
			force:      flags.yes,
			publicKey:  flags['public-key'],
			privateKey: flags['private-key'],
			silent:     this.jsonEnabled() || !process.stdin.isTTY
		});

		if (this.jsonEnabled()) {
			return certs;
		} else {
			for (const { file, label } of Object.values(certs) as any) {
				console.log(`Wrote ${label.toLowerCase()}: ${highlight(file)}`);
			}
		}
	}
}
