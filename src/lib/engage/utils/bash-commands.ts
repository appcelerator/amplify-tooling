import { spawn } from 'child_process';
import path from 'path';
import logger from '../../logger.js';

type OpenSSLPromise = {
	isComplete: boolean;
	code: number | null | Error;
};

const log = logger('engage: bashCommands');

// mask / unmask used in file paths for preventing incorrect params split in "openssl" function
const maskSpaces = (str: string): string => str.replace(/ /g, '<SPACE_REPLACEMENT>');
const unmaskSpaces = (str: string): string => str.replace(/<SPACE_REPLACEMENT>/g, ' ');

export const openssl = (params: string, showStdio: boolean = false) => {
	const parsedParams = params.split(' ').map(unmaskSpaces);
	const process = spawn('openssl', parsedParams, { stdio: showStdio ? 'inherit' : undefined });
	return new Promise<OpenSSLPromise>((resolve) => {
		process.on('exit', (code) => {
			if (code === 0) {
				log.log('openssl command successful');
				resolve({ isComplete: true, code });
			} else {
				log.error(`openssl command unsuccessful, code: ${code}`);
				resolve({ isComplete: false, code });
			}
		});
		process.on('error', (code) => {
			log.error(`openssl command error before exit, code: ${code}`);
			resolve({ isComplete: false, code });
		});
	});
};

export const createTlsCert = async (
	secretName: string,
	domain: string
): Promise<{ cert: string; privateKey: string }> => {
	// note: space in file name is not supported
	const cert = path.join(process.cwd(), `${secretName}.crt`);
	const privateKey = path.join(process.cwd(), `${secretName}.key`);
	try {
		const output = await openssl(
			`req -new -newkey rsa:4096 -days 3650 -nodes -x509 -subj /C=US/ST=AZ/L=Phoenix/O=Axway/CN=${domain} -keyout ${maskSpaces(
				privateKey
			)} -out ${maskSpaces(cert)}`
		);
		if (!output?.isComplete || output.code !== 0) {
			throw new Error(`OpenSSL failed to create the certificate (result: ${String(output?.code)})`);
		}
		return { cert, privateKey };
	} catch (err: any) {
		throw new Error(`Failed to create TLS certificate: ${err?.message || String(err)}`);
	}
};

export const editor = (editorCmd: string, filePath: string): Promise<number | null> => {
	log.log(`editor ${filePath}`);
	// editorCmd may be a multi-word string like "node /path/to/script.js"; split into
	// executable + pre-defined args so that shell:true is not required.
	const [ cmd, ...editorArgs ] = editorCmd.split(' ');
	return new Promise((resolve) => {
		spawn(cmd, [ ...editorArgs, filePath ], { stdio: 'inherit' }).on('exit', (code) => {
			log.log(`editor exit code ${code}`);
			resolve(code);
		});
	});
};
