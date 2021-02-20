/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import CLI, { chalk } from 'cli-kit';
import { checkForUpdate, loadConfig, locations } from '@axway/amplify-cli-utils';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';

(async () => {
	const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json')));
	const { version } = pkg;
	process.env.AMPLIFY_CLI = version;
	process.env.AXWAY_CLI = version;

	const cfg = loadConfig();

	const extensions = [
		...Object.values(cfg.get('extensions', {})),
		dirname(require.resolve('@axway/amplify-cli-auth')),
		dirname(require.resolve('@axway/amplify-cli-pm')),
		dirname(require.resolve('@axway/axway-cli-oum'))
	];

	let checkWait;

	const cli = new CLI({
		banner:       `${chalk.cyan('AXWAY CLI')}, version ${version}
Copyright (c) 2018-2020, Axway, Inc. All Rights Reserved.`,
		commands:     `${__dirname}/commands`,
		desc:         'The Axway CLI is a unified command line interface for the Axway AMPLIFY platform.',
		extensions,
		help:         true,
		helpExitCode: 2,
		name:         'axway',
		version
	});

	cli.on('banner', () => {
		// store the check promise and let it continue asynchronously
		checkWait = checkForUpdate({
			metaDir: resolve(locations.axwayHome, 'axway-cli', 'update'),
			pkg
		}).catch(() => {});
	});

	try {
		const { console } = await cli.exec();

		// now that the command is done, wait for the check to finish and display it's message,
		// if there is one
		if (checkWait) {
			const msg = await checkWait;
			if (msg) {
				console.log(`\n${msg}`);
			}
		}
	} catch (err) {
		const exitCode = err.exitCode || 1;

		if (err.json) {
			console.log(JSON.stringify({
				code: exitCode,
				result: err.toString()
			}, null, 2));
		} else {
			console.error(chalk.red(`${process.platform === 'win32' ? 'x' : '✖'} ${err}`));
		}

		process.exit(exitCode);
	}
})();
