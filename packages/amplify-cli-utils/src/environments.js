/**
 * Environment specific auth settings.
 *
 * @type {Object}
 */
const environments = {
	dev: {
		clientId: 'cli-test-public',
		realm: 'Axway'
	},
	preprod: {
		clientId: 'cli-test-public',
		realm: 'AppcID'
	},
	prod: {
		clientId: 'cli',
		realm: 'Axway'
	}
};

export default environments;
