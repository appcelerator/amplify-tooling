/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import CLI from 'cli-kit';

import { expandPath } from 'appcd-path';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const pkgJson = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json')));

let config = {};
try {
	config = JSON.parse(readFileSync(expandPath('~/.config/axway/amplify-cli.json')));
} catch (e) { }

new CLI({
	help: true,
	helpExitCode: 2,
	name: 'amplify',
	plugins: {
		...(typeof config.plugins === 'object' && config.plugins || {}),
		...pkgJson.plugins
	},
	version: pkgJson.version
}).exec()
	.catch(err => {
		console.error(err.message);
		process.exit(err.exitCode || 1);
	});
