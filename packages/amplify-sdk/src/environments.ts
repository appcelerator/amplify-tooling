interface EnvironmentProps {
	baseUrl: string;
	platformUrl: string;
	realm: string;
}

export interface EnvironmentInfo extends EnvironmentProps {
	name: string;
}

/**
 * Environment specific default settings.
 *
 * @type {Object}
 */
export const environments: { [key: string]: EnvironmentProps } = {
	staging: {
		baseUrl:     'https://login.axwaytest.net',
		platformUrl: 'https://platform.axwaytest.net',
		realm:       'Broker'
	},
	prod: {
		baseUrl:     'https://login.axway.com',
		platformUrl: 'https://platform.axway.com',
		realm:       'Broker'
	}
};

const mapping: { [key: string]: string } = {
	dev:              'staging',
	development:      'staging',
	preprod:          'staging',
	preproduction:    'staging',
	'pre-production': 'staging',
	production:       'prod',
	test:             'staging'
};

export function resolve(env?: string): EnvironmentInfo {
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
