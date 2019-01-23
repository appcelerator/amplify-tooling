import CLI from 'cli-kit';

import { readFileSync } from 'fs';
import { resolve } from 'path';

const { version } = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json')));

export default new CLI({
	commands: `${__dirname}/commands`,
	help: true,
	helpExitCode: 2,
	name: 'auth-example',
	options: {
		'--env <env>': 'the environment to use'
	},
	version
});
