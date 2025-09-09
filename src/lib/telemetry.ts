import fs from 'fs-extra';
import loadConfig from './config.js';
import path from 'path';
import snooplogg from 'snooplogg';
import { createRequestOptions } from './request.js';
import { Telemetry } from './amplify-sdk/index.js';
import { axwayHome } from './path.js';
import * as environments from './environments.js';

const { warn } = snooplogg('amplify-cli-utils:telemetry');
const telemetryCacheDir = path.join(axwayHome, 'axway-cli', 'telemetry');
let telemetryInst = null;

/**
 * If telemetry is enabled, writes the anonymous event data to disk where it will eventually be
 * sent to the Axway platform.
 *
 * @param {Object} payload - the telemetry event payload.
 * @param {Object} [opts] - Various options to pass into the `Telemetry` instance.
 */
export async function addEvent(payload, opts?) {
	// eslint-disable-next-line no-unused-expressions
	const initialize = await init(opts);
	initialize?.addEvent(payload);
}

/**
 * If telemetry is enabled, writes the anonymous crash event to disk where it will eventually be
 * sent to the Axway platform.
 *
 * @param {Object} payload - the telemetry event payload.
 * @param {Object} [opts] - Various options to pass into the `Telemetry` instance.
 */
export async function addCrash(payload, opts?) {
	// eslint-disable-next-line no-unused-expressions
	const initialize = await init(opts);
	initialize?.addCrash(payload);
}

/**
 * Checks if telemetry is enabled, then if it is, creates the telemetry instance and registers the
 * send handler.
 *
 * @param {Object} [opts] - Various options.
 * @param {String} [opts.appGuid] - The platform registered app guid.
 * @param {String} [opts.appVersion] - The app version.
 * @param {Config} [opts.config] - The Axway CLI config object.
 * @param {String} [opts.env] - The environment name.
 * @param {String} [opts.url] - The platform analytics endpoint URL.
 * @returns {Telemetry}
 */
export async function init(opts: any = {}) {
	try {
		if (telemetryInst) {
			return telemetryInst;
		}

		const config = opts.config || await loadConfig();
		if (!await config.get('telemetry.enabled')) {
			return;
		}

		if (!opts.appGuid || typeof opts.appGuid !== 'string') {
			throw new Error('Expected telemetry app guid to be a non-empty string');
		}

		const env = environments.resolve(opts.env || await config.get('env'));

		telemetryInst = new Telemetry({
			appGuid:        opts.appGuid,
			appVersion:     opts.appVersion,
			cacheDir:       telemetryCacheDir,
			environment:    env === 'staging' ? 'preproduction' : 'production',
			requestOptions: createRequestOptions(config),
			url:            opts.url
		});

		process.on('exit', () => {
			try {
				telemetryInst.send({ wait: true });
			} catch (err) {
				warn(err);
			}
		});

		return telemetryInst;
	} catch (err) {
		telemetryInst = null;
		warn(err);
	}
}

/**
 * Checks if telemetry is enabled.
 *
 * @returns {Boolean}
 */
export async function isEnabled() {
	const config = await loadConfig();
	return !!await config.get('telemetry.enabled');
}

/**
 * Nukes the telemetry data directory, if exists.
 */
export function nukeData() {
	fs.removeSync(telemetryCacheDir);
}
