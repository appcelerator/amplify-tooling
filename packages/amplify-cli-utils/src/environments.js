/**
 * Environment specific settings.
 *
 * @type {Object}
 */
export const environments = {
	dev: {
		auth: {
			clientId: 'cli-test-public',
			realm: 'Broker'
		},
		registry: {
			url: 'http://localhost:8082'
		}
	},
	preprod: {
		auth: {
			clientId: 'amplify-cli',
			realm: 'Broker'
		},
		registry: {
			url: 'https://registry.axwaytest.net'
		}
	},
	staging: {
		auth: {
			clientId: 'amplify-cli',
			realm: 'Broker'
		},
		registry: {
			url: 'https://registry.axwaytest.net'
		}
	},
	prod: {
		auth: {
			clientId: 'amplify-cli',
			realm: 'Broker'
		},
		registry: {
			url: 'https://registry.platform.axway.com'
		}
	}
};

export default environments;
