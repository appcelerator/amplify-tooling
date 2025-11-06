/**
 * Environment specific settings.
 *
 * @type {Object}
 */
export const environments = {
	prod: {
		baseUrl: 'https://login.axway.com',
		platformUrl: 'https://platform.axway.com',
		realm: 'Broker',
		title: 'Production'
	}
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
