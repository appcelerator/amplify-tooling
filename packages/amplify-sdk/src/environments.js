/**
 * Environment specific default settings.
 *
 * @type {Object}
 */
export const environments = {
	preprod: {
		baseUrl:     'https://login-preprod.axway.com',
		platformUrl: 'https://platform.axwaytest.net',
		realm:       'Broker'
	},
	prod: {
		baseUrl:     'https://login.axway.com',
		platformUrl: 'https://platform.axway.com',
		realm:       'Broker'
	}
};

const mapping = {
	dev: 'preprod',
	development: 'preprod',
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
