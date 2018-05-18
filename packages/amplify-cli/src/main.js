/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import CLI from 'cli-kit';

import { config } from '@axway/amplify-cli-utils';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const pkgJson = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json')));

let cfg = {};
try {
	cfg = config.read();
} catch (e) { }

const extensions = [
	...Object.values(cfg.extensions || {}),
	require.resolve('@axway/amplify-cli-auth'),
	require.resolve('@axway/amplify-cli-pm')
];
new CLI({
	extensions,
	help: true,
	helpExitCode: 2,
	name: 'amplify',
	version: pkgJson.version
}).exec()
	.catch(err => {
		console.error(err.message);
		process.exit(err.exitCode || 1);
	});

