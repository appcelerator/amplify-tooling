import ci from 'ci-info';
import fs from 'fs-extra';
import path, { dirname } from 'path';
import os from 'os';
import snooplogg, { createInstanceWithDefaults, StripColors } from 'snooplogg';
import * as request from '../request.js';
import * as uuid from 'uuid';
import { isDir, writeFileSync, isFile } from '../fs.js';
import { redact } from '../redact.js';
import { serializeError } from 'serialize-error';
import { execSync, spawnSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = snooplogg('amplify-sdk:telemetry');
const { log } = logger;
const { highlight } = snooplogg.styles;

/**
 * A map of known send process exit codes.
 * @type {Object}
 */
const exitCodes = {
	0: 'Success',
	1: 'Error',
	2: 'Already running',
	ALREADY_RUNNING: 2,
	ERROR: 1
};

/**
 * The number of milliseconds since the last execution before starting a new session.
 * @type {Number}
 */
const sessionTimeout = 24 * 60 * 60 * 1000; // 1 day

/**
 * The number of events to send in a batch.
 * @type {Number}
 */
const sendBatchSize = 10;

/**
 * The default URL to send the data to. Telemetry should always send data to production.
 * @type {String}
 */
const telemetryUrl = 'https://gatekeeper.platform.axway.com/v4/event';

/**
 * Sends anonymous telemetry events for Axway products to help improve our software.
 * Spec: https://techweb.axway.com/confluence/display/analytics/Analytics+JSON+Payload+V4
 */
export default class Telemetry {
	// TODO: Define correct typings for these props
	appDir: string;
	requestOptions?: object;
	url: string;
	common: any;
	count: number;
	sessionId: string;

	/**
	 * Initializes a telemetry instance.
	 *
	 * @param {Object} opts - Various options.
	 * @param {String} opts.appGuid - The platform registered app guid.
	 * @param {String} opts.appVersion - The app version.
	 * @param {String} opts.cacheDir - The path to cache telemetry events.
	 * @param {String} opts.environment - The environment name.
	 * @param {Object} [opts.requestOptions] - HTTP request options with proxy settings and such to
	 * create a `got` HTTP client.
	 * @param {String} [opts.url] - The URL to post the telemetry events to. This option is
	 * intended for testing purposes.
	 * @access public
	 */
	constructor(opts: any) {
		if (!opts || typeof opts !== 'object') {
			throw new TypeError('Expected telemetry options to be an object');
		}

		if (!opts.appGuid || typeof opts.appGuid !== 'string') {
			throw new TypeError('Expected app guid to be a non-empty string');
		}

		if (!opts.appVersion || typeof opts.appVersion !== 'string') {
			throw new TypeError('Expected app version to be a non-empty string');
		}

		if (!opts.cacheDir || typeof opts.cacheDir !== 'string') {
			throw new TypeError('Expected telemetry cache dir to be a non-empty string');
		}

		if (!opts.environment || typeof opts.environment !== 'string') {
			throw new TypeError('Expected environment to be a non-empty string');
		}

		if (opts.requestOptions && typeof opts.requestOptions !== 'object') {
			throw new TypeError('Expected telemetry request options to be an object');
		}

		this.appDir         = path.join(opts.cacheDir, opts.appGuid);
		this.requestOptions = opts.requestOptions;
		this.url            = opts.url || telemetryUrl;

		const arch = _arch();
		const { id, prev, ts }  = this.initId('.sid');

		// init static common data
		this.common = {
			app: opts.appGuid,
			distribution: {
				environment: opts.environment,
				version: opts.appVersion
			},
			hardware: {
				arch,
				id: this.initId('.hid').id
			},
			os: {
				arch,
				...osInfo()
			},
			version: '4'
		};

		this.count = 0;

		if (prev) {
			log('Detected expired session, ending old one and starting new session');
			this.sessionId = prev;
			this.addEvent({
				event: 'session.end'
			});
		}
		this.sessionId = id;
		if (!ts) {
			this.addEvent({
				cpus:         os.cpus().length,
				event:        'session.start',
				memory:       os.totalmem(),
				nodePlatform: process.platform,
				nodeVersion:  process.version
			});
		}
	}

	/**
	 * Prepares and adds a crash report.
	 *
	 * @param {Object|Error} payload - An object or `Error` with the error information.
	 * @param {String} payload.message - The error message.
	 * @param {String} [payload.stack] - The stack trace.
	 * @access public
	 */
	addCrash(payload) {
		if (isTelemetryDisabled() || this.common.distribution.environment !== 'production') {
			return;
		}

		if (!payload || typeof payload !== 'object') {
			throw new TypeError('Expected crash payload to be an object');
		}

		if (payload instanceof Error) {
			// we need to clone the error so that it can be serialized
			payload = serializeError(payload);
		}

		if (!payload.message || typeof payload.message !== 'string') {
			throw new TypeError('Expected crash payload to have a message');
		}

		const homeDir = os.homedir();

		if (typeof payload.stack === 'string') {
			payload.stack = [
				payload.stack.split(/\r\n|\n/).map((line, i) => {
					if (!i) {
						return line;
					}

					// node internal module
					if (/ \(node:/.test(line)) {
						return line;
					}

					let m = line.match(/\(([^:)]*:)/);
					// istanbul ignore if
					if (!m) {
						m = line.match(/at ([^:]*:)/);
						if (!m) {
							return redact(line);
						}
					}

					const filename = path.basename(m[1]);
					let pkgDir = findDir(m[1], 'package.json');

					if (!pkgDir) {
						// no package.json
						return `${m[1].startsWith(homeDir) ? '<HOME>' : ''}/<REDACTED>/${filename}`;
					}

					// we have an node package
					const parent = path.dirname(pkgDir);
					const clean = parent.replace(homeDir, '<HOME>').replace(/\/.*$/, '/<REDACTED>');
					const scrubbed = pkgDir.replace(parent, clean);
					return line.replace(pkgDir, scrubbed);
				}).join('\n')
			];
		} else if (payload.stack && !Array.isArray(payload.stack)) {
			payload.stack = [ payload.stack ];
		}

		this.writeEvent('crash.report', payload);
	}

	/**
	 * Handles incoming add event requests and writes the event to disk.
	 *
	 * @param {Object} payload - An object containing the event name and any event specific data.
	 * @param {String} payload.event - The event name.
	 * @access public
	 */
	addEvent(payload) {
		if (isTelemetryDisabled()) {
			return;
		}

		if (!payload || typeof payload !== 'object') {
			throw new TypeError('Expected telemetry payload to be an object');
		}

		const { event } = payload;
		delete payload.event;
		if (!event || typeof event !== 'string') {
			throw new TypeError('Expected telemetry payload to have an event name');
		}

		// write the event to disk
		this.writeEvent(event, redact(payload, {
			props: [ 'clientSecret', 'password', 'username' ],
			replacements: [
				[ /\/.+\//, '/<REDACTED>/' ]
			]
		}));
	}

	/**
	 * Initializes the hardware or session id if needed and bumps the timestamp.
	 *
	 * @param {String} filename - The name of the file containing the id.
	 * @returns {Object}
	 * @access private
	 */
	initId(filename) {
		const file = path.join(this.appDir, filename);
		let id, prev, ts;
		try {
			({ id, ts } = JSON.parse(fs.readFileSync(file, 'utf-8')));
			ts = Date.parse(ts);
			if (!uuid.validate(id) || isNaN(ts)) {
				throw new Error();
			}
			if ((Date.now() - ts) > sessionTimeout) {
				prev = id;
				throw new Error();
			}
		} catch (err) {
			id = uuid.v4();
			ts = null;
		}
		log(`Initializing id ${id}: ${highlight(file)}`);
		writeFileSync(file, JSON.stringify({ id, ts: new Date().toISOString() }), 'utf-8');
		return { id, prev, ts };
	}

	/**
	 * Spawns a child process to send any pending telemetry events.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Boolean} [opts.wait] - When `true`, blocks until the send process exits.
	 * @returns {Promise}
	 * @access public
	 */
	async send(opts) {
		if (isTelemetryDisabled()) {
			return;
		}

		const child = spawn(process.execPath, [ __filename ], {
			stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ],
			windowsHide: true
		});
		const { pid } = child;

		child.send({
			appDir: this.appDir,
			requestOptions: this.requestOptions,
			url: this.url,
			wait: opts?.wait
		});

		if (opts?.wait) {
			log(`Forked send process (pid: ${pid}), waiting for exit... `);
			await new Promise<void>(resolve => {
				child.on('close', code => {
					const debugLog = path.join(this.appDir, `debug-${pid}.log`);
					if (fs.existsSync(debugLog)) {
						logger(`send-${pid}`).log(fs.readFileSync(debugLog, 'utf-8').trim());
						fs.renameSync(debugLog, path.join(this.appDir, 'debug.log'));
					}
					log(`Send process ${pid} exited with code ${code} (${exitCodes[code] || 'Unknown'})`);
					resolve();
				});
			});
		} else {
			log(`Forked send process (pid: ${pid}), unreferencing child process... `);
			child.unref();
		}
	}

	/**
	 * Writes the event to disk.
	 *
	 * @param {String} event - The event name.
	 * @param {Object} data - The event data payload.
	 * @access private
	 */
	writeEvent(event, data) {
		const id = uuid.v4();
		const now = new Date();
		const ts = `${now.toISOString().replace(/[\WZ]*/ig, '').replace('T', '-')}-${String(++this.count).padStart(4, '0')}`;
		const file = path.join(this.appDir, `${ts}.json`);
		const evt = {
			...this.common,
			data,
			event,
			id,
			session: {
				id: this.sessionId
			},
			timestamp: now.getTime()
		};

		log(`Writing event: ${highlight(file)}`);
		log(evt);

		writeFileSync(file, JSON.stringify(evt));
	}
}

/**
 * When Telemetry::send() is called, it spawns this file using `fork()` which conveniently creates
 * an IPC tunnel. The parent then immediately sends this child process a message with the app dir
 * and other info so that it can send the actual messages without blocking the parent.
 *
 * This child process will not exit until the IPC tunnel has been closed via process.disconnect().
 * The only way to get output from this child process is to either set SNOOPLOGG=* and call
 * Telemetry::send({ wait: true }) -or- look in the app's telemetry data dir for the debug.log file.
 */
process.on('message', async (msg: any) => {
	// istanbul ignore if
	if (!msg || !msg.appDir || !isDir(msg.appDir)) {
		process.disconnect();
		return;
	}

	const { appDir, requestOptions, url, wait } = msg;
	const lockFile = path.join(appDir, '.lock');
	const startTime = Date.now();
	const logFile = fs.createWriteStream(path.join(appDir, wait ? `debug-${process.pid}.log` : 'debug.log'));
	const formatter = new StripColors();
	formatter.pipe(logFile);
	const logger = createInstanceWithDefaults()
		.config({ theme: 'detailed' })
		.enable('*')
		.pipe(formatter, { flush: true })
		.snoop()
		.ns('amplify-sdk:telemetry:send');
	const { error, log, warn } = logger;

	try {
		// if the parent isn't waiting for us, disconnect so the IPC tunnel will be closed and this
		// process can exit gracefully
		if (!wait) {
			process.disconnect();
		}

		log('Telemetry Send Debug Log');
		if (process.env.AXWAY_CLI) {
			log(`Axway CLI, version ${process.env.AXWAY_CLI}`);
		}
		log(`Amplify SDK, version ${fs.readJsonSync(path.resolve(__dirname, '..', 'package.json')).version}`);
		log(`PID: ${process.pid}`);
		log(`Batch size: ${sendBatchSize}`);

		// this function writes the lock file with the current pid to prevent another send process
		// from sending duplicate events
		const acquireLock = async () => {
			for (let i = 1; i < 4; i++) {
				try {
					log(`Attempt ${i}: Writing lock file: ${lockFile}`);
					writeFileSync(lockFile, String(process.pid), { flag: 'wx' });
					log(`Attempt ${i}: Successfully acquired lock`);
					return true;
				} catch (e) {
					const contents = fs.readFileSync(lockFile, 'utf-8').trim();
					const pid = parseInt(contents, 10);

					// istanbul ignore next
					if (isNaN(pid)) {
						log(`Attempt ${i}: Lock file exists, but has bad pid: "${contents}"`);
						fs.removeSync(lockFile);
					} else {
						try {
							// check if pid is still running
							process.kill(pid, 0);
							log(`Attempt ${i}: Another send process (pid: ${pid}) is currently running`);
							return false;
						} catch (e2) {
							log(`Attempt ${i}: Lock file exists, but has stale pid, continuing...`);
							fs.removeSync(lockFile);
						}
					}

					// wait before retrying
					await new Promise(resolve => setTimeout(resolve, 50));
				}
			}
			log('Giving up after 3 attempts');
			return false;
		};

		if (!await acquireLock()) {
			process.exitCode = exitCodes.ALREADY_RUNNING;
			return;
		}

		const got = request.init(requestOptions);
		let last = 0;

		// loop until all events are sent
		for (let batchCounter = 1; true; batchCounter++) {
			const events = fs.readdirSync(appDir).filter(filename => filename.endsWith('.json')).sort();
			if (!events.length || events.length === last) {
				if (batchCounter === 1) {
					log('No events to send');
				}
				break;
			}
			last = events.length;

			log(`Batch ${batchCounter}: Found ${events.length} event${events.length !== 1 ? 's' : ''}`);

			const batch = [];
			for (const filename of events) {
				const file = path.join(appDir, filename);
				try {
					const event = fs.readJsonSync(file);
					if (!event.event) {
						throw new Error('Incomplete event data');
					}
					log(`Batch ${batchCounter}: Adding event ${event.timestamp} "${event.event}"`);
					batch.push({ event, file });
					if (batch.length >= sendBatchSize) {
						break;
					}
				} catch (err) {
					warn(`Batch ${batchCounter}: Bad event ${filename}, deleting`);
					fs.removeSync(file);
				}
			}

			if (!batch.length) {
				break;
			}

			log(`Batch ${batchCounter}: Sending batch with ${batch.length} event${batch.length !== 1 ? 's' : ''}`);
			await got.post({
				json: batch.map(b => b.event),
				retry: 0,
				timeout: 10000,
				url
			});
			log(`Batch ${batchCounter}: Successfully sent ${batch.length} event${batch.length !== 1 ? 's' : ''}`);

			try {
				for (const { file } of batch) {
					log(`Removing ${file}`);
					fs.removeSync(file);
				}
			} catch (err) {
				// istanbul ignore next
				warn(err);
			}
		}
	} catch (err) {
		error(err);
		process.exitCode = exitCodes.ERROR;
	} finally {
		fs.removeSync(lockFile);
		log(`Finished in ${((Date.now() - startTime) / 1000).toFixed(1)} seconds`);
		logFile.close();
		if (wait) {
			process.disconnect();
		}
	}
});

/**
 * Scans up the directory tree looking for a specific file.
 *
 * @param {String} dir - The directory to start in.
 * @param {String} file - The filename to locate.
 * @returns {String}
 */
function findDir(dir, file) {
	const { root } = path.parse(dir);
	let cur = dir;
	let it;

	do {
		it = path.join(cur, file);
		if (fs.existsSync(it)) {
			return cur;
		}
		cur = path.dirname(cur);
	} while (cur !== root);
}

/**
 * Checks the environment variables to see if telemetry should be disabled.
 *
 * @returns {Boolean}
 */
function isTelemetryDisabled() {
	return process.env.AXWAY_TELEMETRY_DISABLED === '1' || (!process.env.AXWAY_TEST && ci.isCI);
}


let archCache = null;

/**
 * Returns the current machine's architecture. Possible values are `x64` for 64-bit and `x86` for
 * 32-bit (i386/ia32) systems.
 *
 * @param {Boolean} [bypassCache] - When true, re-detects the system architecture, though it
 * will never change.
 * @returns {String}
 */
function _arch(bypassCache?) {
	if (archCache && !bypassCache) {
		return archCache;
	}

	// we cache the architecture since it never changes
	const platform = process.env.AXWAY_TEST_PLATFORM || process.platform;
	archCache = process.env.AXWAY_TEST_ARCH || process.arch;

	if (archCache === 'ia32') {
		if ((platform === 'win32' && process.env.PROCESSOR_ARCHITEW6432)
			|| (platform === 'linux' && /64/.test(String(execSync('getconf LONG_BIT'))))) {
			// it's actually 64-bit
			archCache = 'x64';
		} else {
			archCache = 'x86';
		}
	}

	return archCache;
}

/**
 * Tries to resolve the operating system name and version.
 *
 * @returns {Object}
 */
function osInfo() {
	let name = null;
	let version = null;

	switch (process.platform) {
		case 'darwin':
			{
				const stdout = spawnSync('sw_vers').stdout.toString();
				let m = stdout.match(/ProductName:\s+(.+)/i);
				if (m) {
					name = m[1];
				}
				m = stdout.match(/ProductVersion:\s+(.+)/i);
				if (m) {
					version = m[1];
				}
			}
			break;

		case 'linux':
			name = 'GNU/Linux';

			if (isFile('/etc/lsb-release')) {
				const contents = fs.readFileSync('/etc/lsb-release', 'utf8');
				let m = contents.match(/DISTRIB_DESCRIPTION=(.+)/i);
				if (m) {
					name = m[1].replace(/"/g, '');
				}
				m = contents.match(/DISTRIB_RELEASE=(.+)/i);
				if (m) {
					version = m[1].replace(/"/g, '');
				}
			} else if (isFile('/etc/system-release')) {
				const parts = fs.readFileSync('/etc/system-release', 'utf8').split(' ');
				if (parts[0]) {
					name = parts[0];
				}
				if (parts[2]) {
					version = parts[2];
				}
			}
			break;

		case 'win32':
			{
				const stdout = spawnSync('wmic', [ 'os', 'get', 'Caption,Version' ]).stdout.toString();
				const s = stdout.split('\n')[1].split(/ {2,}/);
				if (s.length > 0) {
					name = s[0].trim() || 'Windows';
				}
				if (s.length > 1) {
					version = s[1].trim() || '';
				}
			}
			break;
	}

	return {
		name,
		version
	};
}