import ci from 'ci-info';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import snooplogg, { createInstanceWithDefaults, StripColors } from 'snooplogg';
import * as request from '@axway/amplify-request';
import * as uuid from 'uuid';
import { arch as _arch, osInfo, redact } from 'appcd-util';
import { fork } from 'child_process';
import { isDir, writeFileSync } from 'appcd-fs';
import { serializeError } from 'serialize-error';

const { log } = snooplogg('amplify-sdk:telemetry');
const { highlight } = snooplogg.styles;

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
	constructor(opts) {
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
		if (process.env.TELEMETRY_DISABLED === '1' || ci.isCI || this.common.distribution.environment !== 'production') {
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
			payload.stack = payload.stack.split(/\r\n|\n/).map((line, i) => {
				if (!i) {
					return line;
				}

				let m = line.match(/\(([^:)]*)/);
				// istanbul ignore if
				if (!m) {
					m = line.match(/at ([^:]*)/);
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
			}).join('\n');
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
		if (process.env.TELEMETRY_DISABLED === '1' || ci.isCI) {
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
	 * @access public
	 */
	send() {
		if (process.env.TELEMETRY_DISABLED === '1' || ci.isCI) {
			return;
		}

		log('Forking telemetry send process...');
		const child = fork(module.filename);
		child.send({
			appDir: this.appDir,
			requestOptions: this.requestOptions,
			url: this.url
		});
		child.unref();
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
 * When Telemetry.send() is called, it spawns this file using `fork()` which conveniently creates
 * an IPC tunnel which is used to send the .
 * @param {Object} msg - Send arguments
 */
process.on('message', async msg => {
	process.disconnect();

	// istanbul ignore if
	if (!msg || !msg.appDir) {
		return;
	}

	const { appDir, requestOptions, url } = msg;
	if (!isDir(appDir)) {
		// no directory, no events to send
		return;
	}

	const startTime = Date.now();

	// check if there's a lock file and if its stale
	const lockFile = path.join(appDir, '.lock');
	try {
		// check if it's stale
		const pid = parseInt(fs.readFileSync(lockFile, 'utf-8').split(/\r\n|\n/)[0], 10);
		// istanbul ignore next
		if (!isNaN(pid)) {
			// check if pid is still running
			try {
				process.kill(pid, 0);
				// another send process is running, exit
				process.exit(0);
			} catch (e) {
				// stale pid file
			}
		}
	} catch (e) {
		// lock file does not exist
	}

	// we need to mitigate a possible race condition that occurs during the time it takes to write
	// the lock file, so write a new lock file to a process specific file, then sanity check that
	// the lock file does not exist, then rename the process specific lock file to the correct name
	writeFileSync(`${lockFile}-${process.pid}`, String(process.pid));
	// istanbul ignore if
	if (fs.existsSync(lockFile)) {
		fs.removeSync(`${lockFile}-${process.pid}`);
		process.exit(0);
	}
	fs.renameSync(`${lockFile}-${process.pid}`, lockFile);

	// init the debug log
	const logFile = fs.createWriteStream(path.join(appDir, 'debug.log'));
	const formatter = new StripColors();
	formatter.pipe(logFile);
	const logger = createInstanceWithDefaults()
		.config({ theme: 'detailed' })
		.enable('*')
		.pipe(formatter, { flush: true })
		.snoop()
		.ns('amplify-sdk:telemetry:send');

	const { error, log, warn } = logger;

	log(`PID: ${process.pid}`);
	log(`Batch size: ${sendBatchSize}`);

	try {
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
	} finally {
		fs.removeSync(lockFile);
		log(`Finished in ${((Date.now() - startTime) / 1000).toFixed(1)} seconds`);
		logFile.close();
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
