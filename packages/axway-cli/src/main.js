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
		dirname(require.resolve('@axway/axway-cli-oum')),
		dirname(require.resolve('@axway/axway-cli-pm'))
	];

	let checkWait;

	let banner = `${chalk.cyan('AXWAY CLI')}, version ${version}
Copyright (c) 2018-2021, Axway, Inc. All Rights Reserved.`;

	if (process.versions.node.split('.')[0] < 12) {
		banner += '\n\n' + chalk.yellow(` ┃ ATTENTION! The Node.js version you are currently using (${process.version}) has been
 ┃ deprecated and is unsupported by the Axway CLI v3. Please upgrade Node.js to
 ┃ the latest LTS release: https://nodejs.org/`);
	}

	const cli = new CLI({
		banner,
		commands:         `${__dirname}/commands`,
		desc:             'The Axway CLI is a unified command line interface for the Axway Amplify Platform.',
		extensions,
		help:             true,
		helpExitCode:     2,
		helpTemplateFile: resolve(__dirname, '../templates/help.tpl'),
		name:             'axway',
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
				result: err.toString(),
				detail: err.detail
			}, null, 2));
		} else {
			const msg = `${process.platform === 'win32' ? 'x' : '✖'} ${err}`;
			for (const line of msg.split(/\r\n|\n/)) {
				console.error(chalk.red(`  ${line}`));
			}
			if (err.detail) {
				console.error();
				for (const line of String(err.detail).split(/\r\n|\n/)) {
					console.error(chalk.red(`  ${line}`));
				}
			}
		}

		process.exit(exitCode);
	}
})();
