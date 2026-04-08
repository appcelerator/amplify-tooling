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
				log('openssl command successful');
				resolve({ isComplete: true, code });
			} else {
				log(`openssl command unsuccessful, code: ${code}`);
				resolve({ isComplete: false, code });
			}
		});
		process.on('error', (code) => {
			log(`openssl command error before exit, code: ${code}`);
			resolve({ isComplete: false, code });
		});
	});
};

export const isOpenSslInstalled = async () =>
	await openssl('version').then((res) => {
		if (res && !res.isComplete) {
			throw Error(
				'OpenSSL is not installed, and must be installed to proceed with TLS certificate creation. Please install OpenSSL and try again.'
			);
		}
		return true;
	});

export const createKeyPair = async (): Promise<{ publicKey: string; privateKey: string }> => {
	// note: space in file name is not supported
	const privateKey = path.join(process.cwd(), 'private_key.pem');
	const publicKey = path.join(process.cwd(), 'public_key.pem');
	const privKeyRes = await openssl(
		`genpkey -algorithm RSA -out ${maskSpaces(privateKey)} -pkeyopt rsa_keygen_bits:2048`
	);
	if (privKeyRes.code === 1) {
		throw new Error('OpenSSL failed to create the private key');
	}

	const pubKeyRes = await openssl(`rsa -pubout -in ${maskSpaces(privateKey)} -out ${maskSpaces(publicKey)}`);
	if (pubKeyRes.code === 1) {
		throw new Error('OpenSSL failed to create the public key');
	}

	return { publicKey, privateKey };
};

export const createTlsCert = async (
	secretName: string,
	domain: string
): Promise<{ cert: string; privateKey: string }> => {
	// note: space in file name is not supported
	const cert = path.join(process.cwd(), `${secretName}.crt`);
	const privateKey = path.join(process.cwd(), `${secretName}.key`);
	const output = await openssl(
		`req -new -newkey rsa:4096 -days 3650 -nodes -x509 -subj /C=US/ST=AZ/L=Phoenix/O=Axway/CN=${domain} -keyout ${maskSpaces(
			privateKey
		)} -out ${maskSpaces(cert)}`
	);
	if (output.code === 1) {
		throw new Error('OpenSSL failed to create the certificate');
	}
	return { cert, privateKey };
};

export const editor = (editor: string, filePath: string): Promise<number | null> => {
	log(`editor ${filePath}`);
	return new Promise((resolve) => {
		spawn(editor, [ filePath ], { stdio: 'inherit' }).on('exit', (code) => {
			log(`editor exit code ${code}`);
			resolve(code);
		});
	});
};
