import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const { cyan } = chalk;
const root = path.dirname(fileURLToPath(new URL('.', import.meta.url)));
const all = process.argv.includes('--all');
const cover = process.argv.includes('--coverage');
const coverageDir = path.join(root, 'coverage');

let origHomeDir = process.env.HOME;
let tmpHomeDir = tmp.dirSync({
	mode: '755',
	prefix: 'axway-cli-test-home-',
	unsafeCleanup: true
}).name;

if (all) {
	process.env.AXWAY_TEST = '1'; // allow telemetry tests to run
}
process.env.NODE_ENV = 'test'; // disables the update check
// process.env.SNOOPLOGG = '*'; // uncomment to debug
process.env.SNOOPLOGG_MIN_BRIGHTNESS = '100';
process.env.SPAWN_WRAP_SHIM_ROOT = origHomeDir;

console.log(`Protecting home directory, overriding HOME with temp dir: ${cyan(tmpHomeDir)}`);
process.env.HOME = process.env.USERPROFILE = tmpHomeDir;
if (process.platform === 'win32') {
	process.env.HOMEDRIVE = path.parse(tmpHomeDir).root.replace(/[\\/]/g, '');
	process.env.HOMEPATH = tmpHomeDir.replace(process.env.HOMEDRIVE, '');
}

try {
	await fs.remove(path.join(root, '.nyc_output'));
	await fs.remove(coverageDir);

	const args = [];

	// add c8
	if (cover) {
		args.push(
			path.resolve(resolveModule(root, 'c8'), 'bin', 'c8.js'),
			'--cache', 'true',
			'--exclude', 'test',
			'--exclude', 'packages/*/test/**/*.js', // exclude tests
			'--instrument', 'true',
			'--source-map', 'true',
			// supported reporters:
			//   https://github.com/istanbuljs/istanbuljs/tree/master/packages/istanbul-reports/lib
			'--reporter=html',
			'--reporter=json',
			'--reporter=lcovonly',
			'--reporter=text',
			'--reporter=text-summary',
			'--reporter=cobertura',
			'--show-process-tree',
			process.execPath // need to specify node here so that spawn-wrap works
		);

		process.env.FORCE_COLOR = 1;
		process.env.AXWAY_COVERAGE = root;
	}

	// add mocha
	const mocha = resolveModule(root, 'mocha');
	if (!mocha) {
		console.error(chalk.red('Unable to find mocha!'));
		process.exit(1);
	}
	args.push(path.join(mocha, 'bin', 'mocha.js'));

	// add --inspect
	if (process.argv.includes('--debug') || process.argv.includes('--inspect') || process.argv.includes('--inspect-brk')) {
		args.push('--inspect-brk', '--timeout', '9999999');
	} else {
		args.push('--timeout', 40000);
	}
	args.push('--slow', 15000);

	// add grep
	let p = process.argv.indexOf('--grep');
	if (p !== -1 && p + 1 < process.argv.length) {
		args.push('--grep', process.argv[p + 1]);
	}

	// add suite
	p = process.argv.indexOf('--suite');
	if (p !== -1 && p + 1 < process.argv.length) {
		const suites = process.argv[p + 1].split(',');
		args.push.apply(args, suites.map(s => `test/**/test-${s}.js`));
		if (all) {
			args.push.apply(args, suites.map(s => `packages/*/test/**/test-${s}.js`));
		}
	} else {
		args.push('test/**/test-*.js');
		if (all) {
			args.push('packages/*/test/**/test-*.js');
		}
	}

	// run!
	console.log(`Running: ${chalk.cyan(`${process.execPath} ${args.join(' ')}`)}`);
	if (spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' }).status) {
		console.error(chalk.red('At least one test failed :('));
		process.exit(1);
	}
} finally {
	// restore home directory so that we can delete the temp one
	if (tmpHomeDir) {
		console.log(`Removing temp home directory: ${cyan(tmpHomeDir)}`);
		try {
			fs.removeSync(tmpHomeDir);
		} catch (err) {
			console.log(`Failed to remove temp home directory: ${err.toString()}`);
		}
	}

	console.log(`Restoring home directory: ${cyan(origHomeDir)}`);
	process.env.HOME = origHomeDir;

	if (cover && fs.existsSync(coverageDir)) {
		fs.copySync(path.join(root, 'test', 'helpers', 'report-styles'), coverageDir);
	}
}

function resolveModule(root, name) {
	let dir = path.join(root, name);
	if (fs.existsSync(dir)) {
		return dir;
	}

	try {
		const require = createRequire(import.meta.url);
		return path.dirname(require.resolve(name));
	} catch (e) {
		return null;
	}
}
