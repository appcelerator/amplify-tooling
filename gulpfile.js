'use strict';

const chug         = require('gulp-chug');
const debug        = require('gulp-debug');
const fs           = require('fs-extra');
const globule      = require('globule');
const gulp         = require('gulp');
const log          = require('fancy-log');
const path         = require('path');
const plumber      = require('gulp-plumber');
const spawn        = require('child_process').spawn;
const spawnSync    = require('child_process').spawnSync;
const tmp          = require('tmp');

const { join }     = require('path');
const { red }      = require('chalk');

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
exports.test = series(parallel(nodeInfo, build), function test() {
	return runTests();
});
exports.coverage = series(parallel(nodeInfo, build), function test() {
	return runTests(true);
});

async function runTests(cover, cb) {
	let task = cover ? 'coverage-only' : 'test-only';
	let libCoverage;
	let libReport;
	let reports;
	let coverageDir;
	let mergedCoverageMap;

	if (cover) {
		libCoverage = require('istanbul-lib-coverage');
		libReport = require('istanbul-lib-report');
		reports = require('istanbul-reports');
		coverageDir = path.join(__dirname, 'coverage');
	}

	process.env.SNOOPLOGG = '*';

	const gulp = path.join(path.dirname(require.resolve('gulp')), 'bin', 'gulp.js');
	const gulpfiles = globule.find([ 'packages/*/gulpfile.js' ]);
	const failedProjects = [];

	await gulpfiles
		.reduce((promise, gulpfile) => {
			return promise
				.then(() => new Promise((resolve, reject) => {
					gulpfile = path.resolve(gulpfile);
					const dir = path.dirname(gulpfile);

					log(`Spawning: ${process.execPath} ${gulp} coverage # CWD=${dir}`);
					const child = spawn(process.execPath, [ gulp, task, '--colors' ], { cwd: dir, stdio: [ 'inherit', 'pipe', 'inherit' ] });

					let out = '';
					child.stdout.on('data', data => {
						out += data.toString();
						process.stdout.write(data);
					});

					child.on('close', code => {
						if (!code) {
							log(`Exit code: ${code}`);
							if (cover) {
								for (let coverageFile of globule.find(dir + '/coverage/coverage*.json')) {
									const map = libCoverage.createCoverageMap(JSON.parse(fs.readFileSync(path.resolve(coverageFile), 'utf8')));
									if (mergedCoverageMap) {
										mergedCoverageMap.merge(map);
									} else {
										mergedCoverageMap = map;
									}
								}
							}
						} else if (out.indexOf(`Task '${task}' is not in your gulpfile`) === -1) {
							log(`Exit code: ${code}`);
							failedProjects.push(path.basename(dir));
						} else {
							log(`Exit code: ${code}, no '${task}' task, continuing`);
						}

						resolve();
					});
				}));
		}, Promise.resolve());

	if (cover) {
		fs.removeSync(coverageDir);
		fs.mkdirsSync(coverageDir);
		console.log();

		const ctx = libReport.createContext({
			dir: coverageDir
		});

		const tree = libReport.summarizers.pkg(mergedCoverageMap);
		for (const type of [ 'lcov', 'json', 'text', 'text-summary', 'cobertura' ]) {
			tree.visit(reports.create(type), ctx);
		}
	}

	if (failedProjects.length) {
		if (failedProjects.length === 1) {
			log(red('1 failured project:'));
		} else {
			log(red(`${failedProjects.length} failured projects:`));
		}
		failedProjects.forEach(p => log(red(p)));
		process.exit(1);
	}
}

exports.integration = series(parallel(nodeInfo, build), async function integration() {
	const args = [];
	const mocha = require.resolve('mocha');

	if (!process.argv.includes('--use-global')) {
		process.env.AMPLIFY_BIN = join(__dirname, 'packages', 'amplify-cli', 'bin', 'amplify');
	}
	let axwayHomeDir;
	if (process.argv.includes('--axway-home-parent')) {
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
		process.env.CLEANUP = true
		tmp.setGracefulCleanup();
		axwayHomeDir = tmp.dirSync({ unsafeCleanup: true }).name;
	}

	process.env.HOME = axwayHomeDir;
	process.env.USERPROFILE = axwayHomeDir;

	if (!process.argv.includes('--no-debug-log')) {
		process.env.SNOOPLOGG = 'amplify-integration:*';
	}

	if (!mocha) {
		log('Unable to find mocha!');
		process.exit(1);
	}
	args.push(path.join(mocha, '..', 'bin', 'mocha'));
	args.push('integration-tests/**/test-*.js');
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
