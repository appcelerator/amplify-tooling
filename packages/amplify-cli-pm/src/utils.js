import { loadConfig } from '@axway/amplify-cli-utils';

/**
 * Returns the registry URL from the config.
 *
 * @returns {String}
 */
export function getRegistryURL() {
	const config = loadConfig();
	return config.get('registry.url');
}
