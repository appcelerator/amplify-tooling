/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import os from 'os';
import path from 'path';

export const configFile = path.join(os.homedir(), '.axway', 'amplify-cli.json');

/**
 * Load a users config, if no userConfig is given then the default AMPLIFY CLI config will be
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

	const { default: Config } = require('config-kit');
	const { expandPath } = require('appcd-path');

	const cfg = new Config({
		data: opts.config,
		file: expandPath(opts.configFile || configFile)
	});

	return cfg;
}

export default loadConfig;
