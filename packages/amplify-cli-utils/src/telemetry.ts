import fs from 'fs-extra';
import loadConfig from '@axway/amplify-config';
import path from 'path';
import snooplogg from 'snooplogg';
import { createRequestOptions } from './request.js';
import { Telemetry } from '@axway/amplify-sdk';
import * as environments from './environments.js';
import * as locations from './locations.js';
import { Environment } from './types.js';

const { warn } = snooplogg('amplify-cli-utils:telemetry');
const telemetryCacheDir = path.join(locations.axwayHome, 'axway-cli', 'telemetry');
let telemetryInst: Telemetry | null = null;

/**
 * If telemetry is enabled, writes the anonymous event data to disk where it will eventually be
 * sent to the Axway platform.
 *
 * @param {Object} payload - the telemetry event payload.
 * @param {Object} [opts] - Various options to pass into the `Telemetry` instance.
 */
export function addEvent(payload: any, opts: TelemetryOptions) {
	// eslint-disable-next-line no-unused-expressions
	init(opts)?.addEvent(payload);
}

/**
 * If telemetry is enabled, writes the anonymous crash event to disk where it will eventually be
 * sent to the Axway platform.
 *
 * @param {Object} payload - the telemetry event payload.
 * @param {Object} [opts] - Various options to pass into the `Telemetry` instance.
 */
export function addCrash(payload: any, opts) {
	// eslint-disable-next-line no-unused-expressions
	init(opts)?.addCrash(payload);
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
export async function init(opts = {}) {
	try {
		if (telemetryInst) {
			return telemetryInst;
		}

		const config = opts.config || await loadConfig();
		if (!config.get('telemetry.enabled')) {
			return;
		}

		if (!opts.appGuid || typeof opts.appGuid !== 'string') {
			throw new Error('Expected telemetry app guid to be a non-empty string');
		}

		const env: Environment = environments.resolve(opts.env || config.get('env'));

		telemetryInst = new Telemetry({
			appGuid:        opts.appGuid,
			appVersion:     opts.appVersion,
			cacheDir:       telemetryCacheDir,
			environment:    env === 'staging' ? 'preproduction' : 'production',
			requestOptions: await createRequestOptions(config),
			url:            opts.url
		});

		process.on('exit', () => {
			try {
				telemetryInst?.send();
			} catch (err: any) {
				warn(err);
			}
		});

		return telemetryInst;
	} catch (err: any) {
		telemetryInst = null;
		warn(err);
	}
}

/**
 * Checks if telemetry is enabled.
 *
 * @returns {Boolean}
 */
export async function isEnabled(): Promise<boolean> {
	const cfg = await loadConfig();
	return !!cfg.get('telemetry.enabled');
}

/**
 * Nukes the telemetry data directory, if exists.
 */
export function nukeData() {
	fs.removeSync(telemetryCacheDir);
}
