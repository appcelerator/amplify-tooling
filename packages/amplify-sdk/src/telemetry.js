import ci from 'ci-info';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import * as request from '@axway/amplify-request';
import * as uuid from 'uuid';
import { arch as _arch, osInfo, redact } from 'appcd-util';
import { writeFileSync } from 'appcd-fs';

const disabled = process.env.TELEMETRY_DISABLED === '1' || ci.isCI;

/**
 * ?
 * @type {Number}
 */
const sessionTimeout = 24 * 60 * 60 * 1000;

const telemetryUrl = 'https://gatekeeper.platform.axway.com/v4/event';

/**
 * Sends anonymous telemetry events for Axway products to help improve our software.
 */
export default class Telemetry {
	/**
	 * Initializes a telemetry instance.
	 *
	 * @param {Object} opts - Various options.
	 * @param {String} opts.appGuid - The platform registered app guid.
	 * @param {String} opts.cacheDir - The path to cache telemetry events.
	 * @param {String} opts.environment - The environment name.
	 * @param {Object} [opts.requestOptions] - HTTP request options with proxy settings and such to
	 * create a `got` HTTP client.
	 * @param {String} [opts.url] - The URL to post the telemetry events to.
	 * @param {String} opts.version - The app version.
	 * @access public
	 */
	constructor(opts) {
		if (!opts || typeof opts !== 'object') {
			throw new TypeError('Expected telemetry options to be an object');
		}

		if (opts.appGuid && typeof opts.appGuid !== 'string') {
			throw new TypeError('Expected telemetry app guid to be a string');
		}

		if (opts.cacheDir && typeof opts.cacheDir !== 'string') {
			throw new TypeError('Expected telemetry cache dir to be a string');
		}

		if (!opts.environment || typeof opts.environment !== 'string') {
			throw new TypeError('Expected environment to be a non-empty string');
		}

		if (opts.requestOptions && typeof opts.requestOptions !== 'object') {
			throw new TypeError('Expected telemetry request options to be an object');
		}

		this.cacheDir       = opts.cacheDir;
		this.requestOptions = opts.requestOptions;
		this.url            = opts.url || telemetryUrl;

		const arch = _arch();
		const { id, prev, ts }  = this.initId('.sid');

		// init static common data
		this.common = {
			app: opts.appGuid,
			distribution: {
				environment: opts.environment,
				version: opts.version
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

		if (prev) {
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

	addCrash(payload) {
		if (disabled || this.common.distribution.environment !== 'production') {
			return;
		}

		if (!payload.message || typeof payload.message !== 'string') {
			throw new TypeError('Expected crash payload to have a message');
		}

		payload.event = 'crash.report';
		this.addEvent(payload);
	}

	addEvent(payload) {
		if (disabled) {
			return;
		}

		if (!payload || typeof payload !== 'object') {
			throw new TypeError('Expected telemetry payload to be an object');
		}

		const { event } = payload;
		if (!event || typeof event !== 'string') {
			throw new TypeError('Expected telemetry payload to have an event name');
		}

		const id = uuid.v4();
		const file = path.join(this.cacheDir, this.common.app, `${id}.json`);
		const evt = {
			...this.common,
			data: scrub(event, payload),
			event,
			id,
			session: {
				id: this.sessionId
			},
			timestamp: Date.now()
		};

		// write the event to disk
		writeFileSync(file, JSON.stringify(evt));
	}

	initId(filename) {
		const file = path.join(this.cacheDir, filename);
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
		writeFileSync(file, JSON.stringify({ id, ts: new Date().toISOString() }), 'utf-8');
		return { id, prev, ts };
	}

	send() {
		if (disabled) {
			return;
		}

		// spawn the send process

		// const got = request.init(this.requestOptions);

		// spec: https://techweb.axway.com/confluence/display/analytics/Analytics+JSON+Payload+V4
		// mix in the os info, running in CI, etc
		// ci.isCI

		// send
	}
}

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

function scrub(event, payload) {
	const data = {};
	for (const [ key, value ] of Object.entries(payload)) {
		if (key === 'argv') {
			data[key] = [];
			for (let i = 0; i < value.length; i++) {
				const m = value[i].match(/^(--(?:username|password|client-secret))(?:=(.*))?$/i);
				if (m && m[2]) {
					data[key].push(`${m[1]}=<REDACTED>`);
				} else if (m) {
					data[key].push(m[1]);
					data[key].push('<REDACTED>');
					i++;
				} else {
					data[key].push(redact(value[i]));
				}
			}
			continue;
		}

		if (event === 'crash.report') {
			if (key === 'message') {
				data[key] = value;
				continue;
			}

			if (key === 'stack') {
				const homeDir = os.homedir();
				data[key] = value.split(/\r\n|\n/).map((line, i) => {
					if (!i) {
						return line;
					}

					let m = line.match(/\(([^:)]*)/);
					if (!m) {
						m = line.match(/at ([^:]*)/);
						if (!m) {
							return redact(line);
						}
					}

					const filename = path.basename(m[1]);
					let pkgDir = findDir(m[1], 'package.json');

					if (!pkgDir) {
						return `${m[1].startsWith(homeDir) ? '<HOME>' : ''}/.../${filename}`;
					}

					const parent = path.dirname(pkgDir);
					const clean = parent.replace(homeDir, '<HOME>').replace(/\/.*$/, '/...');
					const scrubbed = pkgDir.replace(parent, clean);

					return line.replace(pkgDir, scrubbed);
				}).join('\n');
				continue;
			}
		}

		data[key] = redact(value, { props: [ 'clientSecret', 'password', 'username' ] });
	}
	return data;
}
