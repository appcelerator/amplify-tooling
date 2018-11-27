/**
 * Environment specific default settings.
 *
 * @type {Object}
 */
export const environments = {
	dev: {
		baseUrl: 'https://login-dev.axway.com',
		platformUrl: ''
	},
	preprod: {
		baseUrl: 'https://login-preprod.axway.com',
		platformUrl: 'https://platform-preprod.axwaytest.net'
	},
	prod: {
		baseUrl: 'https://login.axway.com',
		platformUrl: 'https://platform.axway.com'
	}
};

export default environments;
