import fs from 'fs';
import callerPath from 'caller-path';
import { Chalk } from 'chalk';
import Mustache from 'mustache';
import os from 'os';
import path from 'path';
import logger, { highlight } from '../../dist/lib/logger.js';
import { spawn } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const { log } = logger('test');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliBin = path.resolve(__dirname, `../../bin/${process.env.AXWAY_COVERAGE ? 'dev' : 'run'}.js`);

// Store the last log file created by `runCommand`
let lastLogFile = null;

const defaultVars = {
	check: process.platform === 'win32' ? '√' : '✔',
	delta: '\\d+(\\.\\d+)?\\w( \\d+(\\.\\d+)?\\w)*\\s*',
	localeDateTime: '[\\w\\d/,: ]+',
	string: '[^\\s]+',
	version: '(?:\\d+\\.\\d+\\.\\d+(?:-[^\\s]*)?\\s*)',
	x: process.platform === 'win32' ? 'x' : '✖',
	uuid: '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
	year: (new Date()).getFullYear()
};

// Create a Chalk instance with colors forced on for generating color regex patterns
const coloredChalk = new Chalk({ level: 3 });
for (const fn of [ 'bold', 'cyan', 'gray', 'red', 'underline' ]) {
	defaultVars[fn] = () => {
		return (text, render) => {
			return coloredChalk[fn]('8675309')
				.replace(/(?<!\\)([()[\]?])/g, '\\$1')
				.replace('8675309', render(text));
		};
	};
}

/**
 * Copies a template directory into the Axway CLI home directory (`~/.axway/axway-cli`),
 * setting up the expected config and credential fixtures for a test run.
 * @param {string} templateDir Path to the source template directory. Relative paths are resolved from this file's directory.
 * @returns {void}
 */
export function initHomeDir(templateDir) {
	if (!fs.existsSync(templateDir) && !path.isAbsolute(templateDir)) {
		templateDir = path.resolve(__dirname, templateDir);
	}

	const homeDir = path.join(os.homedir(), '.axway', 'axway-cli');
	log(`Copying ${highlight(templateDir)} => ${highlight(homeDir)}`);
	fs.cpSync(templateDir, homeDir, { recursive: true });
}

/**
 * Renders a Mustache template string as a RegExp
 * @param {string} str Mustache template string to render.
 * @param {Object} [vars] Additional template variables merged on top of the defaults.
 * @returns {RegExp}
 */
export function renderRegex(str, vars) {
	str = str.replace(/([()[\]$?])/g, '\\$1');
	str = Mustache.render(str, Object.assign({}, defaultVars, vars));
	str = str.replace(/\n/g, '\\s*\n');
	// eslint-disable-next-line security/detect-non-literal-regexp
	return new RegExp(str);
}

/**
 * Reads a Mustache template file and renders it as a RegExp.
 * Relative paths are resolved from the calling file's directory.
 * @param {string} file Path to the Mustache template file.
 * @param {Object} [vars] Additional template variables to include when rendering
 * @returns {RegExp}
 */
export function renderRegexFromFile(file, vars) {
	if (!fs.existsSync(file) && !/\.mustache$/.test(file)) {
		file += '.mustache';
	}
	if (!fs.existsSync(file) && !path.isAbsolute(file)) {
		var cp = callerPath();
		switch (process.platform) {
			case 'win32':
				cp = cp.replace('file:///', '');
				break;
			default:
				cp = cp.replace('file://', '');
				break;
		}
		file = path.resolve(path.dirname(cp), file);
	}

	// If LOG_TEST_OUTPUT is enabled and we have a recent log file, update it with the template path
	if (process.env.LOG_TEST_OUTPUT && lastLogFile && fs.existsSync(lastLogFile)) {
		try {
			const logData = JSON.parse(fs.readFileSync(lastLogFile, 'utf8'));
			// Update the most recent invocation with the template path
			if (Array.isArray(logData) && logData.length > 0) {
				logData[logData.length - 1].template = file;
				// Also update in-memory so subsequent runCommand calls don't overwrite this
				if (global.currentTestInvocations?.length > 0) {
					global.currentTestInvocations[global.currentTestInvocations.length - 1].template = file;
				}
				fs.writeFileSync(lastLogFile, JSON.stringify(logData, null, 2));
			}
		} catch {
			// Ignore errors updating the log file
		}
	}

	return renderRegex(fs.readFileSync(file, 'utf8').trim(), vars);
}

/**
 * Empties the temp home directory created for the test run.
 * Must be called as a Mocha hook (e.g. `before(resetHomeDir)`) so that `this` has mocha context.
 */
export function resetHomeDir() {
	this.timeout(60000);

	// sanity check that we're not nuking the real home directory
	const homedir = os.homedir();
	if (homedir.includes(os.tmpdir())) {
		log(`Emptying temp home directory: ${highlight(homedir)}`);
		for (const name of fs.readdirSync(homedir)) {
			fs.rmSync(path.join(homedir, name), { recursive: true, force: true });
		}
	} else {
		log(`Refusing to empty home directory! ${highlight(homedir)}`);
	}
}

/**
 * Spawns the Axway CLI binary as a child process and resolves with the collected stdout,
 * stderr, and exit status once the process exits.
 * @param {string[]} [args=[]] CLI arguments to pass to the binary.
 * @param {Object} [opts={}] Spawn options.
 * @param {boolean} [opts.color] When true, forces colour output via `FORCE_COLOR=3`.
 * @param {string} [opts.shim] Name of a Node.js `--import` shim module to load.
 * @param {Object} [opts.env] Additional environment variables to merge into the child's env.
 * @param {Object} [cfg] Config object serialised and passed to the binary via `--config`.
 * @returns {Promise<{status: number, stdout: string, stderr: string}>}
 */
export function runCommand(args = [], opts = {}, cfg) {
	const child = _runCommand(spawn, args, opts, cfg);
	let stdout = '';
	let stderr = '';
	child.stdout.on('data', s => {
		stdout += s.toString();
		if (process.env.ECHO_CHILD) {
			process.stdout.write(s.toString());
		}
		log(s.toString().trim());
	});
	child.stderr.on('data', s => {
		stderr += s.toString();
		if (process.env.ECHO_CHILD) {
			process.stderr.write(s.toString());
		}
		log(s.toString().trim());
	});
	return new Promise(resolve => child.on('close', status => {
		log(`Process exited (code ${status})`);

		// Log output to file if LOG_TEST_OUTPUT is set
		if (process.env.LOG_TEST_OUTPUT) {
			// Try to get the current test context from Mocha
			let testName;
			try {
				// Access the current test context via Mocha's global state
				const currentTest = global.currentTest || (typeof mocha !== 'undefined' && mocha.currentTest);
				if (currentTest) {
					// Build a test path from the suite hierarchy and test title
					const titles = [];
					let suite = currentTest.parent;
					while (suite && suite.title) {
						titles.unshift(suite.title);
						suite = suite.parent;
					}
					titles.push(currentTest.title);
					testName = titles.join(' - ').replace(/[^a-zA-Z0-9_-]/g, '_');
				} else {
					// Fallback to command-based naming
					testName = (args.length > 0 ? args.join('_') : 'no-args').replace(/[^a-zA-Z0-9_-]/g, '_');
				}
			} catch {
				// Fallback to command-based naming
				testName = (args.length > 0 ? args.join('_') : 'no-args').replace(/[^a-zA-Z0-9_-]/g, '_');
			}

			const logDir = path.join(__dirname, '../.test-output-logs');
			if (!fs.existsSync(logDir)) {
				fs.mkdirSync(logDir, { recursive: true });
			}
			const logFile = path.join(logDir, `${testName}.log`);

			// Initialize the invocations array if it doesn't exist
			if (!global.currentTestInvocations) {
				global.currentTestInvocations = [];
			}

			// Add this invocation to the array
			global.currentTestInvocations.push({
				args,
				opts: { color: opts.color, shim: opts.shim },
				status,
				stdout,
				stderr,
				template: null
			});

			// Write all invocations to the log file
			fs.writeFileSync(logFile, JSON.stringify(global.currentTestInvocations, null, 2));
			console.log(`📝 Logged output to: ${logFile}`);

			// Store the log file path so renderRegexFromFile can update it with the template path
			lastLogFile = logFile;
		}

		resolve({ status, stdout, stderr });
	}));
}

/**
 * Logs in to the Axway CLI with the default test service account.
 * @returns {Promise<{status: number, stdout: string, stderr: string}>}
 */
export async function loginCLI() {
	return runCommand([ 'auth', 'login', '--client-id', 'test-auth-client-secret', '--client-secret', 'shhhh' ]);
}

function _runCommand(fn, args = [], opts = {},  cfg) {
	const env = Object.assign({}, process.env, opts.env);
	// Set an artificially high value for oclif terminal width so we have consistent output width for testing regardless
	// of the actual terminal size the tests are run in. This prevents issues with wrapped output that can occur in
	// smaller terminal windows and CI environments, and ensures consistent snapshots and regex matching.
	env.OCLIF_COLUMNS = '512';
	// Keep COLUMNS in sync for any non-oclif width consumers.
	env.COLUMNS = '512';

	if (env.AXWAY_TEST) {
		// If color option is explicitly set, use it; otherwise don't set FORCE_COLOR
		if (opts.color === true) {
			env.FORCE_COLOR = '3';
		} else if (args.includes('--no-color') || args.includes('--no-colors')) {
			delete env.FORCE_COLOR;
		}
	}

	if (cfg) {
		args.unshift('--config', JSON.stringify(cfg));
	}

	args.unshift(cliBin);

	if (opts.shim) {
		args.unshift('--import', pathToFileURL(path.join(__dirname, `${opts.shim}.js`)));
	}

	log(`Executing: ${highlight(`${process.execPath} ${cliBin} ${args.join(' ')}`)}`);
	return fn(process.execPath, args, {
		ignoreExitCodes: true,
		windowsHide: true,
		...opts,
		env
	});
}
