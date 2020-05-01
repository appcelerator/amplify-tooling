'use strict';

const chug         = require('gulp-chug');
const debug        = require('gulp-debug');
const fs           = require('fs-extra');
const gulp         = require('gulp');
const log          = require('fancy-log');
const path         = require('path');
const plumber      = require('gulp-plumber');
const spawnSync    = require('child_process').spawnSync;
const tmp          = require('tmp');

const { join }     = require('path');
const { parallel, series } = gulp;

const nodeInfo = exports['node-info'] = async function nodeInfo() {
	log(`Node.js ${process.version} (${process.platform})`);
	log(process.env);
};

/*
 * lint tasks
 */
exports.lint = function lint() {
	return gulp
		.src([
			path.join(__dirname, 'packages/*/gulpfile.js')
		])
		.pipe(debug({ title: 'Linting project:' }))
		.pipe(plumber())
		.pipe(chug({ tasks: [ 'lint' ] }));
};

/*
 * build tasks
 */
const build = exports.build = async function build() {
	return runLernaBuild();
};

/*
 * test tasks
 */
exports.test = series(nodeInfo, build, function test() {
	return runTests();
});
exports.coverage = series(nodeInfo, build, function coverage() {
	return runTests(true, true);
});

async function runTests(cover, all) {
	process.env.APPCD_TEST_GLOBAL_PACKAGE_DIR = path.join(__dirname, 'packages');
	process.env.SNOOPLOGG = '*';
	const runner = require('appcd-gulp/src/test-runner');
	return runner.runTests({ root: __dirname, projectDir: __dirname, cover, all });
}

exports.integration = series(parallel(nodeInfo, build), async function integration() {
	const args = [];
	const mocha = require.resolve('mocha');

	if (!process.argv.includes('--use-global')) {
		process.env.AMPLIFY_BIN = join(__dirname, 'packages', 'amplify-cli', 'bin', 'amplify');
	}
	let axwayHomeDir;
	if (process.argv.includes('--axway-home')) {
		const argIndex = process.argv.indexOf('--axway-home-parent') + 1;
		const homeArg = process.argv[argIndex];
		if (!homeArg) {
			log('A directory must be specified with the "--axway-home-parent" flag');
			process.exit(1);
		}
		if (!fs.existsSync(homeArg)) {
			log(`The supplied argument for "--axway-home-parent" "${homeArg}" does not exist.`);
			process.exit(1);
		}
		axwayHomeDir = homeArg;
	} else {
		tmp.setGracefulCleanup();
		axwayHomeDir = tmp.dirSync({ unsafeCleanup: true }).name;
	}

	process.env.HOME = axwayHomeDir;
	process.env.USERPROFILE = axwayHomeDir;

	if (!mocha) {
		log('Unable to find mocha!');
		process.exit(1);
	}
	args.push(path.join(mocha, '..', 'bin', 'mocha'));
	args.push('integration-tests/test-*.js');
	log('Running: ' + process.execPath + ' ' + args.join(' '));

	if (spawnSync(process.execPath, args, { stdio: 'inherit' }).status) {
		const err = new Error('At least one test failed :(');
		err.showStack = false;
		throw err;
	}
});

/*
 * watch task
 */
exports.watch = series(build, async function watch() {
	const srcWatcher = gulp
		.watch(`${__dirname}/packages/*/src/**/*.js`)
		.on('all', (type, path) => {
			// FIXME: There's almost certainly a better way of doing this than replacing \\ with /
			path = path.replace(/\\/g, '/');
			const m = path.match(new RegExp(`^(${__dirname.replace(/\\/g, '/')}/(packages/([^\/]+)))`));
			if (m) {
				log(`Detected change: ${cyan(path)}`);
				const pkgJson = path.join(m[1], 'package.json');

				try {
					runLernaBuild(JSON.parse(fs.readFileSync(pkgJson)).name);
				} catch (e) {
					log(`Failed to read/parse ${pkgJson}: ${e.toString()}`);
				}
			}
		});

	let stopping = false;

	return new Promise(resolve => {
		process.on('SIGINT', () => {
			if (!stopping) {
				stopping = true;
				srcWatcher.close();
				resolve();
			}
		});
	});
});

async function runLernaBuild(scope) {
	let { execPath } = process;
	const args = [ './node_modules/.bin/lerna', 'run', 'build', '--parallel' ];

	if (process.platform === 'win32') {
		args.shift();
		execPath = path.join(__dirname, 'node_modules', '.bin', 'lerna.cmd');
	}

	if (scope) {
		args.push('--scope', scope);
	}

	log(`Running ${execPath} ${args.join(' ')}`);
	const { status } = spawnSync(execPath, args, { stdio: 'inherit' });
	if (status) {
		throw new Error(`lerna build failed ${scope ? `for ${scope}` : ''}`);
	}
}
