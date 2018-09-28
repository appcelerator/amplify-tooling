import { loadConfig } from '@axway/amplify-cli-utils';
let userAgent;
/**
 * Returns the registry URL from the config.
 *
 * @returns {String}
 */
export function getRegistryParams(env) {
	const config = loadConfig();
	return {
		env: env || config.get('env') || 'prod',
		headers: {
			'User-Agent': buildUserAgentString()
		},
		url: config.get('registry.url')
	};
}

/**
 * Convert an error thrown by the `fetchAndInstall` function into something
 * human readable/actionable.
 * @param {Error} exitCode - Error thrown by the install process.
 * @returns {Object} Object with a message and code property, representing
 * the message to be logged and the process exitCode.
 */
export function handleInstallError(error) {
	let { message, stack } = error;
	let exitCode = 1;

	switch (error.code) {
		case 'ECONNREFUSED':
			message = 'Unable to connect to registry server';
			exitCode = 3;
			break;
		case 'EINVALIDIR':
			message = `You are in an invalid directory to install this component type\n${error.message}`;
			break;
		case 'ENONPM':
			message = error.message;
			break;
		case 'ENPMINSTALLERROR':
			// TODO: Need to break this error down into some sort of actionable items
			message = `An error occurred when running "npm install"\n${error.stack}`;
			break;
		case 'NO_DATA':
			message = 'No results found';
			break;
		default :
			message = `${message}\n${stack}`;
			break;
	}
	return {
		message,
		exitCode
	};
}

export function buildUserAgentString() {
	if (userAgent) {
		return userAgent;
	}
	if (process.env.AMPLIFY_CLI) {
		return userAgent = `AMPLIFY-CLI/${process.env.AMPLIFY_CLI} AMPLIFY-CLI-PM/${require('../package.json').version}`;
	} else {
		return userAgent = `AMPLIFY-CLI-PM/${require('../package.json').version}`;

	}
}
