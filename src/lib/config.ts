import { Config } from 'config-kit';
import os from 'os';
import path from 'path';
import { expandPath } from './path.js';
import { isFile, readJsonSync, writeFileSync } from './fs.js';

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
export async function loadConfig(opts: any = {}) {
	// validate the config options
	if (opts.config && (typeof opts.config !== 'object' || Array.isArray(opts.config))) {
		throw new TypeError('Expected config to be an object');
	}

	if (opts.configFile && typeof opts.configFile !== 'string') {
		throw new TypeError('Expected config file to be a string');
	}

	// TODO: Remove this pre-2.1.0 conf file handling as we're now moving to 5.0.0?
	// in v2.1.0, the config file was moved to keep the ~/.axway directory tidy as other Axway
	// CLI's are added
	const legacyConfigFile = path.join(axwayHome, 'amplify-cli.json');
	if (!isFile(configFile) && isFile(legacyConfigFile)) {
		const json = readJsonSync(legacyConfigFile);
		json.extensions = {};
		writeFileSync(configFile, JSON.stringify(json, null, 2));
	}
	return await new Config().init({
		data: opts.config,
		file: expandPath(opts.configFile || configFile)
	});
}

export default loadConfig;

export { Config };
