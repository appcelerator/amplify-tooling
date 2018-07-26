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
	help: true,
	helpExitCode: 2,
	name: 'amplify-cli-auth',
	options: {
		'--env <name>': {
			desc: 'the environment to use'
		}
	},
	version
});
