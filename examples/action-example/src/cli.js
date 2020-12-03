import CLI from 'cli-kit';

import { readFileSync } from 'fs';
import { resolve } from 'path';

const { version } = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json')));

export default new CLI({
	help: true,
	helpExitCode: 2,
	name: 'action-example',
	version
});
