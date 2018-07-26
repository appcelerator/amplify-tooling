import CLI from 'cli-kit';

import login from './commands/login';
import logout from './commands/logout';

import { readFileSync } from 'fs';
import { resolve } from 'path';

const { version } = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json')));

export default new CLI({
	commands: {
		login,
		logout
	},
	desc: 'The AMPLIFY Auth CLI authenticates with the Axway AMPLIFY platform, manages access tokens, and retreives user information.',
	help: true,
	helpExitCode: 2,
	name: 'amplify-cli-auth',
	options: {
		'--base-url <url>': {
			hidden: true
		},
		'--client-id <id>': {
			hidden: true
		},
		'--env <name>': {
			desc: 'the environment to use'
		},
		'--realm <realm>': {
			hidden: true
		}
	},
	version
});
