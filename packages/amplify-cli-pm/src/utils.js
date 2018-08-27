import { loadConfig } from '@axway/amplify-cli-utils';

/**
 * Returns the registry URL from the config.
 *
 * @returns {String}
 */
export function getRegistryParams(env) {
	const config = loadConfig();
	return {
		env: env || config.get('env') || 'prod',
		url: config.get('registry.url')
	};
}
