/**
 * Environment specific default settings.
 *
 * @type {Object}
 */
export const environments = {
	staging: {
		baseUrl:     'https://login.axwaytest.net',
		platformUrl: 'https://platform.axwaytest.net',
		realm:       'Broker'
	},
	prod: {
		us: {
			baseUrl:     'https://login.axway.com',
			platformUrl: 'https://platform.axway.com',
			realm:       'Broker'
		},
		eu: {
			baseUrl:     'https://login.eu-fr.axway.com',
			platformUrl: 'https://platform.eu-fr.axway.com',
			realm:       'Broker'
		},
	}
};

const mapping = {
	dev: 'staging',
	development: 'staging',
	preprod: 'staging',
	preproduction: 'staging',
	'pre-production': 'staging',
	production: 'prod',
	test: 'staging'
};

export function resolve(env, reg) {
	let environment = 'prod';
	let region = 'us';
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
	if (reg) {
		if (typeof reg !== 'string') {
			throw new TypeError('Expected region to be a string');
		}
		region = reg.toLowerCase();
		if (!environments[environment][region]) {
			throw new Error(`Invalid region "${reg}" for environment "${env}"`);
		}
	}

	return {
		name: environment,
		...environments[environment][region]
	};
}
