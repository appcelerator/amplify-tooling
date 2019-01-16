/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import CLI, { chalk } from 'cli-kit';

import { dirname, resolve } from 'path';
import { loadConfig } from '@axway/amplify-cli-utils';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json')));

const cfg = loadConfig();

const extensions = [
	...Object.values(cfg.get('extensions', {})),
	dirname(require.resolve('@axway/amplify-cli-auth')),
	dirname(require.resolve('@axway/amplify-cli-pm'))
];

const banner = `${chalk.cyan('AMPLIFY CLI')}, version ${version}\n`
		+ 'Copyright (c) 2018, Axway, Inc. All Rights Reserved.';

process.env.AMPLIFY_CLI = version;

new CLI({
	banner,
	commands: `${__dirname}/commands`,
	desc: 'The AMPLIFY CLI is a unified command line interface for the Axway AMPLIFY platform.',
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
			console.error(err.message || err);
		}

		process.exit(exitCode);
	});
