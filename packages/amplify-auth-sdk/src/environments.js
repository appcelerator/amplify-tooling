/**
 * Environment specific default settings.
 *
 * @type {Object}
 */
export const environments = {
	dev: {
		baseUrl: 'https://login-dev.axway.com'
	},
	preprod: {
		baseUrl: 'https://login-preprod.axway.com'
	},
	prod: {
		baseUrl: 'https://login.axway.com'
	}
};

export default environments;
