import fs from 'fs';
import path from 'path';
import os from 'os';
import { stripVTControlCharacters } from 'util';
import { fileURLToPath } from 'url';
import { execSync, spawnSync, spawn } from 'child_process';

import ci from 'ci-info';
import logger, { highlight } from '../logger.js';
import * as request from '../request.js';
import { v4 as uuidv4, validate as validateUUID } from 'uuid';
import { isDir, writeFileSync, readJsonSync, isFile } from '../fs.js';
import { redact } from '../redact.js';
import { serializeError } from 'serialize-error';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(__filename, '../../../..');

const { log } = logger('amplify-sdk:telemetry');

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

interface TelemetryOptions {
	appGuid: string;
	appVersion: string;
	cacheDir: string;
	enabled?: boolean;
	requestOptions?: object;
	url: string;
}

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
	enabled = true;

	/**
	 * Initializes a telemetry instance.
	 *
	 * @param {Object} opts - Various options.
	 * @param {String} opts.appGuid - The platform registered app guid.
	 * @param {String} opts.appVersion - The app version.
	 * @param {String} opts.cacheDir - The path to cache telemetry events.
	 * @param {Boolean} opts.enabled - Whether telemetry is enabled.
	 * @param {String} opts.environment - The environment name.
	 * @param {Object} [opts.requestOptions] - HTTP request options with proxy settings and such to
	 * create a `got` HTTP client.
	 * @param {String} [opts.url] - The URL to post the telemetry events to. This option is
	 * intended for testing purposes.
	 */
	constructor(opts: TelemetryOptions) {
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

		if (opts.requestOptions && typeof opts.requestOptions !== 'object') {
			throw new TypeError('Expected telemetry request options to be an object');
		}

		if (!opts.url || typeof opts.url !== 'string') {
			throw new TypeError('Expected telemetry URL to be a non-empty string');
		}

		if (opts.enabled === false) {
			this.enabled = false;
		}

		this.appDir         = path.join(opts.cacheDir, opts.appGuid);
		this.requestOptions = opts.requestOptions;
		this.url            = opts.url;

		const arch = _arch();
		const { id, prev, ts }  = this.initId('.sid');

		// init static common data
		this.common = {
			app: opts.appGuid,
			distribution: {
				environment: process.env.NODE_ENV || 'production',
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
		if (this.isTelemetryDisabled() || this.common.distribution.environment !== 'production') {
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

		if (typeof payload.stack === 'string') {
			payload.stack = [
				payload.stack
					.split(/\r\n|\n/)
					// Sanitize the stack trace to remove any sensitive data
					.map(line => redact(line
						// As well as user specific paths
						.replaceAll(rootDir, '')
						// And clear out any build-specific protocol injection
						.replace('file://', '')
					))
					.join('\n')
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
		if (this.isTelemetryDisabled()) {
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
			if (!validateUUID(id) || isNaN(ts)) {
				throw new Error();
			}
			if ((Date.now() - ts) > sessionTimeout) {
				prev = id;
				throw new Error();
			}
		} catch (_err) {
			id = uuidv4();
			ts = null;
		}
		log(`Initializing id ${id}: ${highlight(file)}`);
		writeFileSync(file, JSON.stringify({ id, ts: new Date().toISOString() }), 'utf-8');
		return { id, prev, ts };
	}

	/**
	 * Spawns a child process to send any pending telemetry events.
	 *
	 * @returns {Promise}
	 * @access public
	 */
	async send() {
		if (this.isTelemetryDisabled()) {
			return;
		}

		const child = spawn(process.execPath, [ __filename ], {
			stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ],
			windowsHide: true
		});

		const { pid } = child;

		try {
			// Debug outputs to stderr, so pipe it to our log file
			const logFile = fs.createWriteStream(path.join(this.appDir, `debug-${pid}.log`));
			// If the log file errors, log to our main logger and end the file stream
			logFile.on('error', function (err) {
				logger(`amplify-sdk:telemetry:${pid}`).error(err);
				logFile.end();
			});

			child.stderr.on('data', (chunk) => {
				logFile.write(stripVTControlCharacters(chunk.toString()));
			});

			child.send({
				appDir: this.appDir,
				requestOptions: this.requestOptions,
				url: this.url
			});

			log(`Forked send process (pid: ${pid}), waiting for exit... `);
			await new Promise<void>(resolve => {
				child.on('close', code => {
					logFile.close(() => {
						const debugLog = path.join(this.appDir, `debug-${pid}.log`);
						if (fs.existsSync(debugLog)) {
							logger(`amplify-sdk:telemetry:${pid}`).log(fs.readFileSync(debugLog, 'utf-8').trim());
							fs.renameSync(debugLog, path.join(this.appDir, 'debug.log'));
						}
						log(`Send process ${pid} exited with code ${code} (${exitCodes[code] || 'Unknown'})`);
						resolve();
					});
				});
			});
		} catch (err) {
			logger(`amplify-sdk:telemetry:${pid}`).error(err);
		} finally {
			try {
				child.kill();
			} catch (_err) {
				// ignore
			}
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
		const id = uuidv4();
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

	/**
	 * Checks the environment variables to see if telemetry should be disabled.
	 *
	 * @returns {Boolean}
	 */
	isTelemetryDisabled() {
		return !this.enabled || process.env.AXWAY_TELEMETRY_DISABLED === '1' || (!process.env.AXWAY_TEST && ci.isCI);
	}
}

/**
 * When Telemetry::send() is called, it spawns this file using `fork()` which conveniently creates
 * an IPC tunnel. The parent then immediately sends this child process a message with the app dir
 * and other info so that it can send the actual messages without blocking the parent.
 *
 * This child process will not exit until the IPC tunnel has been closed via process.disconnect().
 * The only way to get output from this child process is to either set DEBUG=* and call
 * Telemetry::send() -or- look in the app's telemetry data dir for the debug.log file.
 */
process.on('message', async (msg: any) => {
	// istanbul ignore if
	if (!msg || !msg.appDir || !isDir(msg.appDir)) {
		process.disconnect();
		return;
	}

	const { appDir, requestOptions, url } = msg;
	const lockFile = path.join(appDir, '.lock');
	const startTime = Date.now();
	const { error, log, warn } = logger('amplify-sdk:telemetry:send');

	try {
		log('Telemetry Send Debug Log');
		if (process.env.AXWAY_CLI) {
			log(`Axway CLI, version ${process.env.AXWAY_CLI}`);
		}
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
				} catch (_e) {
					const contents = fs.readFileSync(lockFile, 'utf-8').trim();
					const pid = parseInt(contents, 10);

					// istanbul ignore next
					if (isNaN(pid)) {
						log(`Attempt ${i}: Lock file exists, but has bad pid: "${contents}"`);
						fs.rmSync(lockFile, { force: true });
					} else {
						try {
							// check if pid is still running
							process.kill(pid, 0);
							log(`Attempt ${i}: Another send process (pid: ${pid}) is currently running`);
							return false;
						} catch (_e2) {
							log(`Attempt ${i}: Lock file exists, but has stale pid, continuing...`);
							fs.rmSync(lockFile, { force: true });
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
					const event = readJsonSync(file);
					if (!event.event) {
						throw new Error('Incomplete event data');
					}
					log(`Batch ${batchCounter}: Adding event ${event.timestamp} "${event.event}"`);
					batch.push({ event, file });
					if (batch.length >= sendBatchSize) {
						break;
					}
				} catch (_err) {
					warn(`Batch ${batchCounter}: Bad event ${filename}, deleting`);
					fs.rmSync(file, { force: true });
				}
			}

			if (!batch.length) {
				break;
			}

			log(`Batch ${batchCounter}: Sending batch with ${batch.length} event${batch.length !== 1 ? 's' : ''}`);
			try {
				await got.post({
					json: {
						events: batch.map(b => b.event)
					},
					retry: { limit: 0 },
					timeout: { request: 10000 },
					url
				});
			} catch (err) {
				error(`Batch ${batchCounter}: Failed to send batch: ${err.message}`);
				process.exitCode = exitCodes.ERROR;
				break;
			}
			log(`Batch ${batchCounter}: Successfully sent ${batch.length} event${batch.length !== 1 ? 's' : ''}`);

			try {
				for (const { file } of batch) {
					log(`Removing ${file}`);
					fs.rmSync(file, { force: true });
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
		fs.rmSync(lockFile, { force: true });
		log(`Finished in ${((Date.now() - startTime) / 1000).toFixed(1)} seconds`);
		process.disconnect();
	}
});

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
