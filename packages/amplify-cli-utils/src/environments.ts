import { Environment } from './types.js';

interface EnvironmentDefaults {
	dev: {},
	staging: {},
	prod: {}
}

/**
 * Environment specific settings.
 *
 * @type {Object}
 */
export const environments: EnvironmentDefaults = {
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
	let environment: string = 'prod';
	if (env) {
		if (typeof env !== 'string') {
			throw new TypeError('Expected environment to be a string');
		}
		environment = env.toLowerCase();
		environment = mapping[environment as keyof EnvironmentMapping] || environment;
		if (!environments[environment as keyof EnvironmentDefaults]) {
			throw new Error(`Invalid environment "${env}"`);
		}
	}

	return {
		name: environment,
		...environments[environment as keyof EnvironmentDefaults]
	} as Environment;
}
