/**
 * Environment specific default settings.
 *
 * @type {Object}
 */
export const environments = {
	dev: {
		baseUrl: 'https://login-dev.axway.com',
		platformUrl: 'https://platform.axwaytest.net'
	},
	preprod: {
		baseUrl: 'https://login-preprod.axway.com',
		platformUrl: 'https://platform.axwaytest.net'
	},
	staging: {
		baseUrl: 'https://login-preprod.axway.com',
		platformUrl: 'https://platform.axwaytest.net'
	},
	prod: {
		baseUrl: 'https://login.axway.com',
		platformUrl: 'https://platform.axway.com'
	}
};

export default environments;
