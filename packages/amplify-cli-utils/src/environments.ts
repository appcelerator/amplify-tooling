import { Environment } from './types.js';

interface EnvironmentDefaults {
	auth: {
		clientId: string,
		realm: string
	},
	title: string
}

interface EnvironmentDefaultsMap {
	dev:     EnvironmentDefaults,
	staging: EnvironmentDefaults,
	prod:    EnvironmentDefaults
}

/**
 * Environment specific settings.
 *
 * @type {Object}
 */
export const environments: EnvironmentDefaultsMap = {
	dev: {
		auth: {
			clientId: 'cli-test-public',
			realm: 'Broker'
		},
		title: 'Development'
	},
	staging: {
		auth: {
			clientId: 'amplify-cli',
			realm: 'Broker'
		},
		title: 'Staging'
	},
	prod: {
		auth: {
			clientId: 'amplify-cli',
			realm: 'Broker'
		},
		title: 'Production'
	}
};

interface EnvironmentMapping {
	development: string,
	preprod: string,
	preproduction: string,
	'pre-production': string,
	production: string,
	test: string,
}

const mapping: EnvironmentMapping = {
	development:      'dev',
	preprod:          'staging',
	preproduction:    'staging',
	'pre-production': 'staging',
	production:       'prod',
	test:             'staging'
};

export function resolve(env: string): Environment {
	let environment = 'prod';
	if (env) {
		if (typeof env !== 'string') {
			throw new TypeError('Expected environment to be a string');
		}
		environment = env.toLowerCase();
		environment = mapping[environment as keyof EnvironmentMapping] || environment;
		if (!environments[environment as keyof EnvironmentDefaultsMap]) {
			throw new Error(`Invalid environment "${env}"`);
		}
	}

	return {
		name: environment,
		...environments[environment as keyof EnvironmentDefaultsMap]
	} as Environment;
}
