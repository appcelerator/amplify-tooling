/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import CLI from 'cli-kit';

import { expandPath } from 'appcd-path';
import { config } from '@axway/amplify-cli-utils';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const pkgJson = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json')));

let cfg = {};
try {
	cfg = config.read();
} catch (e) { }

new CLI({
	help: true,
	helpExitCode: 2,
	name: 'amplify',
	extensions: {
		...(typeof cfg.extensions === 'object' && cfg.extensions || {}),
		...pkgJson.extensions
	},
	version: pkgJson.version
}).exec()
	.catch(err => {
		console.error(err.message);
		process.exit(err.exitCode || 1);
	});
