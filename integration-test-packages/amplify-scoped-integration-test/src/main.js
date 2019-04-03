const cli = require('./cli');

cli.exec()
	.catch(err => {
		console.error(err);
		process.exit(err.exitCode || 1);
	});
