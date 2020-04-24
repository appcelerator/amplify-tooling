import CLI from 'cli-kit';

import { readFileSync } from 'fs';
import { resolve } from 'path';

const { version } = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json')));

export default new CLI({
	commands: `${__dirname}/commands`,
	help: true,
	helpExitCode: 2,
	name: 'amplify-cli-pm',
	options: {
		'--env [env]': 'the environment to use',
		'--json': 'outputs accounts as JSON'
	},
	version
});
