/**
 * Environment specific settings.
 *
 * @type {Object}
 */
export const environments = {
	dev: {
		auth: {
			clientId: 'cli-test-public',
			realm: 'Axway'
		},
		registry: {
			url: 'http://localhost:8082'
		}
	},
	preprod: {
		auth: {
			clientId: 'cli-test-public',
			realm: 'AppcID'
		},
		registry: {
			url: 'https://registry.axwaytest.net'
		}
	},
	prod: {
		auth: {
			clientId: 'cli',
			realm: 'Axway'
		},
		registry: {
			url: 'https://registry.platform.axway.com'
		}
	}
};

export default environments;
