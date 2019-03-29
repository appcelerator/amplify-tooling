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
 * @param {String} [opts.configFile] - Path to the config file to load as the reference.
 * @param {String} [opts.userConfigFile=~/.axway/amplify-cli.json] - Path to the user defined
 * config file. If the file does not exist, an empty object will be written
 * @returns {Config} An appcd-config instance
 */
export function loadConfig({ configFile: appConfigFile, userConfigFile } = {}) {
	const { existsSync, outputJSONSync } = require('fs-extra');
	const Config = require('appcd-config').default;

	if (!userConfigFile) {
		userConfigFile = configFile;
	}

	if (!existsSync(userConfigFile)) {
		outputJSONSync(userConfigFile, {});
	}

	const cfg = new Config({ configFile: appConfigFile });
	cfg.userConfigFile = userConfigFile;
	cfg.loadUserConfig(userConfigFile);

	return cfg;
}

export default loadConfig;
