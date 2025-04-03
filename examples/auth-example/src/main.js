import sourceMapSupport from 'source-map-support';
/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	sourceMapSupport.install();
}

import cli from './cli';

cli.exec()
	.catch(err => {
		console.error(err);
		process.exit(err.exitCode || 1);
	});
