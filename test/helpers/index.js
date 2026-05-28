import fs from 'fs';
import callerPath from 'caller-path';
import { Chalk } from 'chalk';
import Mustache from 'mustache';
import os from 'os';
import path from 'path';
import logger, { highlight } from '../../dist/lib/logger.js';
import { AmplifySDK, Auth, MemoryStore } from '../../dist/lib/amplify-sdk/index.js';
import { spawn } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const { log } = logger('test');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const axwayBin = path.resolve(__dirname, `../../bin/${process.env.AXWAY_COVERAGE ? 'dev' : 'run'}.js`);

export function initHomeDir(templateDir) {
	if (!fs.existsSync(templateDir) && !path.isAbsolute(templateDir)) {
		templateDir = path.resolve(__dirname, templateDir);
	}

	const homeDir = path.join(os.homedir(), '.axway', 'axway-cli');
	log(`Copying ${highlight(templateDir)} => ${highlight(homeDir)}`);
	fs.cpSync(templateDir, homeDir, { recursive: true });
}

const defaultVars = {
	check: process.platform === 'win32' ? '√' : '✔',
	delta: '\\d+(\\.\\d+)?\\w( \\d+(\\.\\d+)?\\w)*\\s*',
	localeDateTime: '[\\w\\d/,: ]+',
	nodeDeprecationWarning: '(?:\n*\u001b\\[33m ┃ ATTENTION! The Node\\.js version you are currently using \\(v\\d+\\.\\d+\\.\\d+\\) has been\u001b\\[39m\n\u001b\\[33m ┃ deprecated and is unsupported in Axway CLI v3 and newer\\. Please upgrade\u001b\\[39m\n\u001b\\[33m ┃ Node\\.js to the latest LTS release: https://nodejs\\.org/\u001b\\[39m)?',
	nodeDeprecationWarningNoColor: '(?:\n* ┃ ATTENTION! The Node\\.js version you are currently using \\(v\\d+\\.\\d+\\.\\d+\\) has been\n ┃ deprecated and is unsupported in Axway CLI v3 and newer\\. Please upgrade\n ┃ Node\\.js to the latest LTS release: https://nodejs\\.org/)?',
	startRed: '(?:\u001b\\[31m)?',
	string: '[^\\s]+',
	url: 'http[^\\s]+',
	version: '(?:\\d+\\.\\d+\\.\\d+(?:-[^\\s]*)?\\s*)',
	versionList: '(?:\u001b\\[36m(?:\\d+\\.\\d+\\.\\d+(?:-[^\\s]*)?\\s*)*\\s*\u001b\\[39m\n+)+',
	versionWithColor: '(?:(?:\u001b\\[\\d\\dm)?\\d+(?:\\.(?:\u001b\\[\\d\\dm)?\\d+){2}(?:-[^\\s]*)?(?:\u001b\\[39m)?\\s*)',
	whitespace: ' *',
	x: process.platform === 'win32' ? 'x' : '✖',
	uuid: '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
	year: (new Date()).getFullYear()
};

// Create a Chalk instance with colors forced on for generating color regex patterns
const coloredChalk = new Chalk({ level: 3 });
for (const fn of [ 'bold', 'blue', 'cyan', 'gray', 'green', 'magenta', 'red', 'yellow', 'underline' ]) {
	defaultVars[fn] = () => {
		return (text, render) => {
			return coloredChalk[fn]('8675309')
				.replace(/(?<!\\)([()[\]?])/g, '\\$1')
				.replace('8675309', render(text));
		};
	};
}

export function renderRegex(str, vars) {
	str = str.replace(/([()[\]$?])/g, '\\$1');
	str = Mustache.render(str, Object.assign({}, defaultVars, vars));
	str = str.replace(/\n/g, '\\s*\n');
	// eslint-disable-next-line security/detect-non-literal-regexp
	return new RegExp(str);
}

// Store the last log file created by runAxwaySync
let lastLogFile = null;

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
				fs.writeFileSync(lastLogFile, JSON.stringify(logData, null, 2));
			}
		} catch {
			// Ignore errors updating the log file
		}
	}

	return renderRegex(fs.readFileSync(file, 'utf8').trim(), vars);
}

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

function _runAxway(fn, args = [], opts = {},  cfg) {
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

	args.unshift(axwayBin);

	if (opts.shim) {
		args.unshift('--import', pathToFileURL(path.join(__dirname, `${opts.shim}.js`)));
	}

	log(`Executing: ${highlight(`${process.execPath} ${axwayBin} ${args.join(' ')}`)}`);
	return fn(process.execPath, args, {
		ignoreExitCodes: true,
		windowsHide: true,
		...opts,
		env
	});
}

export function runAxway(args = [], opts = {},  cfg) {
	return _runAxway(spawn, args, opts, cfg);
}

export function runAxwaySync(args = [], opts = {},  cfg) {
	const child = _runAxway(spawn, args, opts, cfg);
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
			console.log(`\n📝 Logged output to: ${logFile}`);

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
export async function loginCLISync() {
	return runAxwaySync([ 'auth', 'login', '--client-id', 'test-auth-client-secret', '--client-secret', 'shhhh' ]);
}

/**
 * Creates an AmplifySDK instance and logs in with the default test service account.
 * @param {boolean|object} authenticated If truthy then the SDK will be authenticated. If an object then it is used as the login options.
 * @returns {Promise<{
 * 	auth: Auth,
 * 	account: import('../../dist/lib/amplify-sdk/auth').Account,
 * 	sdk: AmplifySDK,
 * 	tokenStore: MemoryStore
 * }>}
 */
export async function createSdkSync(authenticated) {
	const tokenStore = new MemoryStore();
	let auth;
	let account;

	// If authentication is requested, create an Auth instance and log in
	if (authenticated) {
		auth = new Auth({
			baseUrl: 'http://127.0.0.1:8555',
			clientId: 'test_client',
			realm: 'test_realm',
			tokenStore
		});
		// If authenticated is an object then use it as the login options
		account = await auth.login(typeof authenticated === 'object' ? authenticated : {
			clientId: 'test-auth-client-secret',
			clientSecret: 'shhhh'
		});
	}

	// Create the SDK instance
	const sdk = new AmplifySDK({
		baseUrl: 'http://127.0.0.1:8555',
		clientId: 'test_client',
		platformUrl: 'http://127.0.0.1:8666',
		realm: 'test_realm',
		tokenStore,
		tokenStoreType: 'memory'
	});

	// If we authenticated above then find the session to populate the SDK with the necessary session info
	if (authenticated && account) {
		await sdk.auth.findSession(account);
	}

	return { auth, account, sdk, tokenStore };
}

export function stripColors(s) {
	return s.replace(/\x1B\[\d+m/g, '');
}
