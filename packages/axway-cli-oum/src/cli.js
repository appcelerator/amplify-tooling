import CLI from 'cli-kit';

import { readFileSync } from 'fs';
import { resolve } from 'path';

const { version } = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json')));

export default new CLI({
	desc: 'Manages AMPLIFY organizations and users.',
	commands: [
		`${__dirname}/org.js`,
		`${__dirname}/user.js`
	],
	help: true,
	helpExitCode: 2,
	name: 'oum',
	version
});
