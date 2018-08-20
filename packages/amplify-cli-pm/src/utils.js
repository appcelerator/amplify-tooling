import { loadConfig } from '@axway/amplify-cli-utils';

export function getRegistryURL() {
	const config = loadConfig();
	return config.get('registry.url');
}
