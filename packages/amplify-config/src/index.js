/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Config from 'config-kit';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { expandPath, isFile, writeFileSync } from '@axway/amplify-utils';

const axwayHome = path.join(os.homedir(), '.axway');

export const configFile = path.join(axwayHome, 'axway-cli', 'config.json');

/**
 * Load a users config, if no userConfig is given then the default Axway CLI config will be
 * loaded.
 *
 * @param {Object} [opts] - An object with various options.
 * @param {Object} [opts.config] - A object to initialize the config with. Note that if a
 * `configFile` is also specified, this `config` is applied AFTER the config file has been loaded.
 * @param {String} [opts.configFile] - The path to a .js or .json config file to load.
 * @returns {Config}
 */
export function loadConfig(opts = {}) {
	// validate the config options
	if (opts.config && (typeof opts.config !== 'object' || Array.isArray(opts.config))) {
		throw new TypeError('Expected config to be an object');
	}

	if (opts.configFile && typeof opts.configFile !== 'string') {
		throw new TypeError('Expected config file to be a string');
	}

	// in v2.1.0, the config file was moved to keep the ~/.axway directory tidy as other Axway
	// CLI's are added
	const legacyConfigFile = path.join(axwayHome, 'amplify-cli.json');
	if (!isFile(configFile) && isFile(legacyConfigFile)) {
		const json = fs.readJsonSync(legacyConfigFile);
		json.extensions = {};
		writeFileSync(configFile, JSON.stringify(json, null, 2));
	}

	return new Config({
		data: opts.config,
		file: expandPath(opts.configFile || configFile)
	});
}

export default loadConfig;

export { Config };
