/**
 * Environment specific settings.
 *
 * @type {Object}
 */
export const environments = {
	dev: {
		auth: {
			clientId: 'cli-test-public',
			realm: 'Broker'
		},
		registry: {
			url: 'http://localhost:8082'
		},
		title: 'Development'
	},
	staging: {
		auth: {
			clientId: 'amplify-cli',
			realm: 'Broker'
		},
		registry: {
			url: 'https://registry.axwaytest.net'
		},
		title: 'Staging'
	},
	prod: {
		auth: {
			clientId: 'amplify-cli',
			realm: 'Broker'
		},
		registry: {
			url: 'https://registry.platform.axway.com'
		},
		title: 'Production'
	}
};

const mapping = {
	development: 'dev',
	preprod: 'staging',
	preproduction: 'staging',
	'pre-production': 'staging',
	production: 'prod',
	test: 'staging'
};

export function resolve(env) {
	let environment = 'prod';
	if (env) {
		if (typeof env !== 'string') {
			throw new TypeError('Expected environment to be a string');
		}
		environment = env.toLowerCase();
		environment = mapping[environment] || environment;
		if (!environments[environment]) {
			throw new Error(`Invalid environment "${env}"`);
		}
	}

	return {
		name: environment,
		...environments[environment]
	};
}
