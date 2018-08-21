import CLI from 'cli-kit';

import install from './commands/install';
import list from './commands/list';
import purge from './commands/purge';
import search from './commands/search';
import uninstall from './commands/uninstall';
import update from './commands/update';
import use from './commands/use';
import view from './commands/view';

import { readFileSync } from 'fs';
import { resolve } from 'path';

const { version } = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json')));

export default new CLI({
	commands: {
		install,
		list,
		purge,
		search,
		uninstall,
		update,
		use,
		view
	},
	help: true,
	helpExitCode: 2,
	name: 'amplify-cli-pm',
	options: {
		'--env <env>': 'the environment to use',
		'--json': 'outputs accounts as JSON'
	},
	version
});
