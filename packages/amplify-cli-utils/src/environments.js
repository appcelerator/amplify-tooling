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
	preprod: {
		auth: {
			clientId: 'amplify-cli',
			realm: 'Broker'
		},
		registry: {
			url: 'https://registry.axwaytest.net'
		},
		title: 'Pre-Production'
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
	preproduction: 'preprod',
	'pre-production': 'preprod',
	production: 'prod',
	staging: 'preprod',
	test: 'preprod'
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
