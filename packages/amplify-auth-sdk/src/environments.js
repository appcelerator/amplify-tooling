/**
 * Environment specific default settings.
 *
 * @type {Object}
 */
export const environments = {
	dev: {
		baseUrl: 'https://login-dev.axway.com',
		redirectLoginSuccess: 'https://platform.axwaytest.net/'
	},
	preprod: {
		baseUrl: 'https://login-preprod.axway.com',
		redirectLoginSuccess: 'https://platform.axwaytest.net/'
	},
	prod: {
		baseUrl: 'https://login.axway.com',
		redirectLoginSuccess: 'https://platform.axway.com/'
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
