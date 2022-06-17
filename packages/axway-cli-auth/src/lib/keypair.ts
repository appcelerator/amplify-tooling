import path from 'path';
import { existsSync, writeFileSync } from '@axway/amplify-utils';
import { initSDK } from '@axway/amplify-cli-utils';
import { prompt } from 'enquirer';
import { CLIError } from 'cli-kit';

export interface GenerateKeypairOptions {
	force?: boolean;
	privateKey?: string;
	publicKey?: string;
	silent?: boolean;
}

export interface KeyInfo {
	file: string,
	label: string
}

export interface Keypair {
	privateKey: KeyInfo,
	publicKey: KeyInfo
}

/**
 * Generates a public/private keypair. It prompts for the output filenames and whether to overwrite
 * if needed.
 *
 * @param {Object} opts - Various options.
 * @param {Boolean} [opts.force] - When `true`, uses the default output filenames and overwrites if
 * already exists.
 * @param {String} [opts.privateKey] - The path to write the generated private key to.
 * @param {String} [opts.publicKey] - The path to write the generated public key to.
 * @param {Boolean} [opts.silent] - When `true`, prompting is disabled and unspecified output
 * files will assume the defaults. If the destination files exist, an error is thrown.
 * @returns {Promise<Object>} Resolves the generated `publicKey` and `privateKey`.
 */
export async function generateKeypair(opts: GenerateKeypairOptions = {}): Promise<Keypair> {
	if (!opts || typeof opts !== 'object') {
		throw new TypeError('Expected options to be an object');
	}

	const { force, publicKey, privateKey, silent } = opts;
	const { sdk } = await initSDK();
	const certs = await sdk.client.generateKeyPair();

	const files = {
		privateKey: await validate({
			force,
			initial: 'private_key.pem',
			label:   'Private key',
			silent,
			value:   privateKey
		}),

		publicKey: await validate({
			force,
			initial: 'public_key.pem',
			label:   'Public key',
			silent,
			value:   publicKey
		})
	};

	return Object.keys(files).reduce((result, type) => {
		if (files[type as keyof Keypair]) {
			writeFileSync(files[type as keyof Keypair].file, certs[type as keyof Keypair]);
			result[type as keyof Keypair] = files[type as keyof Keypair];
			result[type as keyof Keypair].cert = certs[type as keyof Keypair];
		}
		return result;
	}, {} as Keypair);
}

/**
 * Prompts for the output file and checks if the file already exists.
 *
 * @param {Object} opts - Various options.
 * @param {Boolean} opts.force - When `true`, uses the default output filenames and overwrites if
 * already exists.
 * @param {String} opts.initial - The default output file path.
 * @param {String} opts.label - The key type.
 * @param {Boolean} opts.silent - When `true`, prompting is disabled.
 * @param {String} opts.value - The output file path.
 * @returns {Promise}
 */
async function validate({ force, initial, label, silent, value }: {
	force?: boolean,
	initial: string,
	label: string,
	silent?: boolean,
	value?: string
}): Promise<KeyInfo | undefined> {
	if (!value) {
		value = initial;

		if (!silent) {
			({ value } = await prompt({
				initial,
				message: `${label} output file`,
				name: 'value',
				type: 'input',
				validate(s) {
					return s ? true : `Please enter the ${label.toLowerCase()} output file`;
				}
			}));
		}
	}

	const file = path.resolve(value as string);

	if (existsSync(file) && !force) {
		if (silent) {
			const err = new Error(`${label} file exists: ${value}`) as CLIError;
			err.showHelp = false;
			throw err;
		}
		const { overwrite } = await prompt({
			message: `"${file}" already exists, overwrite?`,
			name: 'overwrite',
			type: 'confirm'
		}) as any;
		if (!overwrite) {
			return;
		}
	}

	return { file, label };
}
