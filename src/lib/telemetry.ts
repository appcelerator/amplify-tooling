import fs from 'fs';
import loadConfig from './config.js';
import path from 'path';
import logger from './logger.js';
import { createRequestOptions } from './request.js';
import { Telemetry } from './amplify-sdk/index.js';
import { axwayHome } from './path.js';
import * as environments from './environments.js';

const { warn } = logger('telemetry');
const telemetryCacheDir = path.join(axwayHome, 'axway-cli', 'telemetry');
let telemetryInst: Telemetry;

/**
 * If telemetry is enabled, writes the anonymous event data to disk where it will eventually be
 * sent to the Axway platform.
 *
 * @param {Object} payload - the telemetry event payload.
 * @param {Object} [opts] - Various options to pass into the `Telemetry` instance.
 */
export async function addEvent(payload: object, opts?: object) {
	const instance = await init(opts);
	instance?.addEvent(payload);
}

/**
 * If telemetry is enabled, writes the anonymous crash event to disk where it will eventually be
 * sent to the Axway platform.
 *
 * @param {Object} payload - the telemetry event payload.
 * @param {Object} [opts] - Various options to pass into the `Telemetry` instance.
 */
export async function addCrash(payload: object, opts?: object) {
	const instance = await init(opts);
	instance?.addCrash(payload);
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
export async function init(opts: any = {}): Promise<Telemetry> {
	if (telemetryInst) {
		return telemetryInst;
	}

	try {
		const config = opts.config || await loadConfig();

		if (!opts.appGuid || typeof opts.appGuid !== 'string') {
			throw new Error('Expected telemetry app guid to be a non-empty string');
		}

		const env = environments.resolve(opts.env || config.get('env'));
		const platformUrl = config.get('auth.platformUrl');

		telemetryInst = new Telemetry({
			enabled: config.get('telemetry.enabled'),
			appGuid: opts.appGuid,
			appVersion: opts.appVersion,
			cacheDir: opts.cacheDir || telemetryCacheDir,
			environment: env === 'staging' ? 'preproduction' : 'production',
			requestOptions: createRequestOptions(config),
			url: opts.url || (platformUrl + '/api/v1/analytics')
		});

	} catch (err) {
		telemetryInst = null;
		warn(err);
	}
	return telemetryInst;
}

/**
 * Checks if telemetry is enabled.
 *
 * @returns {Boolean}
 */
export async function isEnabled(): Promise<boolean> {
	const config = await loadConfig();
	return !!await config.get('telemetry.enabled');
}

/**
 * Nukes the telemetry data directory, if exists.
 */
export function nukeData() {
	fs.rmSync(telemetryCacheDir, { recursive: true, force: true });
}
