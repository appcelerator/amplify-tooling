/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import CLI, { chalk } from 'cli-kit';
import config from './commands/config';

import { loadConfig } from '@axway/amplify-cli-utils';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const { version } = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json')));

const cfg =  loadConfig();

const extensions = [
	...Object.values(cfg.get('extensions', {})),
	require.resolve('@axway/amplify-cli-auth'),
	require.resolve('@axway/amplify-cli-pm')
];

let banner;
if (!process.env.hasOwnProperty('APPC_NPM_VERSION')) {
	banner = `${chalk.cyan('Amplify CLI')}, version ${version}\n`
		+ 'Copyright (c) 2018, Axway, Inc. All Rights Reserved.';
}

new CLI({
	banner,
	commands: {
		config
	},
	extensions,
	help: true,
	helpExitCode: 2,
	name: 'amplify',
	version
}).exec()
	.catch(err => {
		const exitCode = err.exitCode || 1;

		if (err.json) {
			console.log(JSON.stringify({
				code: exitCode,
				result: err.toString()
			}, null, 2));
		} else {
			console.error(err.message);
		}

		process.exit(exitCode);
	});
