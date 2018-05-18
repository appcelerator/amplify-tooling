/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import cli from './cli';

cli.exec()
	.catch(err => {
		console.error(err);
		process.exit(err.exitCode || 1);
	});
