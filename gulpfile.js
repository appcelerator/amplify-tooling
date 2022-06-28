'use strict';

const ansiColors   = require('ansi-colors');
const fs           = require('fs-extra');
const gulp         = require('gulp');
const log          = require('fancy-log');
const path         = require('path');
const tmp          = require('tmp');

const { series } = gulp;
const { cyan } = ansiColors;

const nodeInfo = exports['node-info'] = async function nodeInfo() {
	log(`Node.js ${process.version} (${process.platform})`);
	log(process.env);
};

/*
 * test tasks
 */
let origHomeDir = process.env.HOME;
let tmpHomeDir = null;

async function runTests(cover, all) {
	try {
		await fs.remove(path.join(__dirname, '.nyc_output'));
		await fs.remove(path.join(__dirname, 'coverage'));

		if (all) {
			process.env.AXWAY_TEST = '1'; // allow telemetry tests to run
		}
		process.env.AXWAY_TEST_GLOBAL_PACKAGE_DIR = path.join(__dirname, 'packages');
		process.env.SPAWN_WRAP_SHIM_ROOT = origHomeDir;
		process.env.NODE_ENV = 'test'; // disables the update check
		// process.env.SNOOPLOGG = '*';

		tmpHomeDir = tmp.dirSync({
			mode: '755',
			prefix: 'axway-cli-test-home-',
			unsafeCleanup: true
		}).name;

		log(`Protecting home directory, overriding HOME with temp dir: ${cyan(tmpHomeDir)}`);
		process.env.HOME = process.env.USERPROFILE = tmpHomeDir;
		if (process.platform === 'win32') {
			process.env.HOMEDRIVE = path.parse(tmpHomeDir).root.replace(/[\\/]/g, '');
			process.env.HOMEPATH = tmpHomeDir.replace(process.env.HOMEDRIVE, '');
		}

		const runner = require('@axway/gulp-tasks/src/test-runner');
		await runner.runTests({
			all,
			cover,
			projectDir: __dirname,
			root: __dirname,
			slow: 15000,
			timeout: 40000
		});
	} finally {
		// restore home directory so that we can delete the temp one
		if (tmpHomeDir) {
			log(`Removing temp home directory: ${cyan(tmpHomeDir)}`);
			try {
				fs.removeSync(tmpHomeDir);
			} catch (err) {
				log(`Failed to remove temp home directory: ${err.toString()}`);
			}
		}

		log(`Restoring home directory: ${cyan(origHomeDir)}`);
		process.env.HOME = origHomeDir;
	}
}

exports.integration         = series(nodeInfo, build, function test()     { return runTests(true); });
exports['integration-only'] = series(nodeInfo,        function test()     { return runTests(true); });
exports.test                = series(nodeInfo, build, function coverage() { return runTests(true, true); });
