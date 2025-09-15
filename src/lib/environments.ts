/**
 * Environment specific settings.
 *
 * @type {Object}
 */
export const environments = {
	prod: {
		baseUrl:     'https://login.axway.com',
		platformUrl: 'https://platform.axway.com',
		auth: {
			clientId: 'amplify-cli',
			realm: 'Broker'
		},
		registry: {
			url: 'https://registry.platform.axway.com'
		},
		title: 'Production'
	}
	// TODO: Add EU2 environment definition
};

const mapping = {
	production: 'prod'
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
