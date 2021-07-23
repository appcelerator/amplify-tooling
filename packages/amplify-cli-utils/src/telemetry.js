import fs from 'fs-extra';
import loadConfig from '@axway/amplify-config';
import path from 'path';
import snooplogg from 'snooplogg';
import { createRequestOptions } from './request';
import { Telemetry } from '@axway/amplify-sdk';
import * as environments from './environments';
import * as locations from './locations';

const { warn } = snooplogg('amplify-cli-utils:telemetry');
const axwayCLIAppGuid = '1d99561b-8770-428c-84b2-5bef95ce263d';
const telemetryCacheDir = path.join(locations.axwayHome, 'axway-cli', 'telemetry');
let telemetryInst;

/**
 * If telemetry is enabled, writes the anonymous event data to disk where it will eventually be
 * sent to the Axway platform.
 *
 * @param {Object} payload - the telemetry event payload.
 * @param {Object} [opts] - Various options to pass into the `Telemetry` instance.
 */
export function addEvent(payload, opts) {
	callTelemetry('addEvent', payload, opts);
}

/**
 * If telemetry is enabled, writes the anonymous crash event to disk where it will eventually be
 * sent to the Axway platform.
 *
 * @param {Object} payload - the telemetry event payload.
 * @param {Object} [opts] - Various options to pass into the `Telemetry` instance.
 */
export function addCrash(payload, opts) {
	callTelemetry('addCrash', payload, opts);
}

/**
 * Checks if telemetry is enabled, then if it is, creates a telemetry instance, registers the send
 * handler, and adds the telemetry event.
 *
 * @param {String} method - The telemetry event method to call.
 * @param {Object} payload - the telemetry event payload.
 * @param {Object} [opts] - Various options.
 * @param {String} [opts.appGuid] - The platform registered app guid.
 * @param {Config} [opts.config] - The Axway CLI config object.
 * @param {String} [opts.env] - The environment name.
 * @param {String} [opts.url] - The platform analytics endpoint URL.
 * @param {String} [opts.version] - The app version.
 */
function callTelemetry(method, payload, opts = {}) {
	if (process.env.AXWAY_TELEMETRY_DISABLED === '1') {
		return;
	}

	const config = opts.config || loadConfig();
	if (!config.get('telemetry.enabled')) {
		return;
	}

	if (!telemetryInst) {
		const env = environments.resolve(opts.env || config.get('env'));

		try {
			telemetryInst = new Telemetry({
				appGuid:        opts.appGuid || axwayCLIAppGuid,
				cacheDir:       telemetryCacheDir,
				environment:    env === 'preprod' ? 'preproduction' : 'production',
				requestOptions: createRequestOptions(opts, config),
				url:            opts.url,
				version:        opts.version
			});

			process.on('exit', () => {
				try {
					telemetryInst.send();
				} catch (err) {
					warn(err);
				}
			});
		} catch (err) {
			warn(err);
		}
	}

	// eslint-disable-next-line no-unused-expressions
	telemetryInst?.[method](payload);
}

/**
 * Checks if telemetry is enabled.
 *
 * @returns {Boolean}
 */
export function isEnabled() {
	return !!loadConfig().get('telemetry.enabled');
}

/**
 * Nukes the telemetry data directory, if exists.
 */
export function nukeData() {
	fs.removeSync(telemetryCacheDir);
}
