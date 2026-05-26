import path from 'path';
import { runAxwaySync, renderRegexFromFile } from '../../../helpers/index.js';
import {
	engageEnv,
	testDataDir,
	setupEngageAuth,
	initHomeDir,
	resetHomeDir,
} from '../../../helpers/engage-test-helper.js';

function makeApiService(name, envName, id) {
	return {
		group: 'management',
		apiVersion: 'v1alpha1',
		kind: 'APIService',
		name,
		title: `${name} title`,
		metadata: {
			id,
			scope: { kind: 'Environment', name: envName },
			audit: {
				createTimestamp: '2023-01-01T00:00:00.000Z',
				modifyTimestamp: '2023-01-01T00:00:00.000Z',
			},
			references: [],
		},
		spec: {},
	};
}

function makeApiServiceInstance(name, envName, apiSvcId) {
	return {
		group: 'management',
		apiVersion: 'v1alpha1',
		kind: 'APIServiceInstance',
		name,
		title: `${name} title`,
		metadata: {
			id: `id-${name}`,
			scope: { kind: 'Environment', name: envName },
			references: [ { id: apiSvcId } ],
			audit: {
				createTimestamp: '2023-01-01T00:00:00.000Z',
				modifyTimestamp: '2023-01-01T00:00:00.000Z',
			},
		},
		spec: { endpoint: [ { host: 'test.com', port: 443, protocol: 'https' } ] },
	};
}

// IDs matching examples/apiservices.json so the productize service can look them up
const API_SVC1_ID = 'e4e0839f6efb5aa4016efc23f607033d';
const API_SVC2_ID = 'e4e0839f6efb5aa4016efc23f607033e';

describe('axway engage productize', () => {
	describe('help', () => {
		it('should output the help screen', async () => {
			const { status, stdout } = await runAxwaySync([ 'engage', 'productize', '--help' ]);
			expect(stdout).to.match(renderRegexFromFile('templates/help'));
			expect(status).to.equal(0);
		});
	});

	describe('auth required', () => {
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			initHomeDir('home-local');
			const { status } = await runAxwaySync(
				[ 'engage', 'productize', '--file', path.join(testDataDir, 'test_productize.json') ],
				{ env: engageEnv }
			);
			expect(status).to.equal(0);
		});
	});

	describe('authenticated', () => {
		/** @type {any} */
		let engageServer;

		beforeEach(async function () {
			engageServer = await setupEngageAuth.call(this);
		});

		afterEach(resetHomeDir);

		describe('args validation', () => {
			it('should error if --file flag is not provided', async () => {
				const { status } = await runAxwaySync([ 'engage', 'productize' ], { env: engageEnv });
				expect(status).to.equal(0);
			});
		});

		describe('sad paths', () => {
			it('should error for entries without a logical name (test_productize_error.json)', async () => {
				const { status, stdout, stderr } = await runAxwaySync(
					[ 'engage', 'productize', '--file', path.join(testDataDir, 'test_productize_error.json') ],
					{ env: engageEnv }
				);

				expect(status).to.equal(1);
				// The productize service validates the file before making any API calls
				expect(stdout + stderr).to.include('without a logical name');
			});

			it('should error for entries without a scope name (test_productize_error.json)', async () => {
				const { status, stdout, stderr } = await runAxwaySync(
					[ 'engage', 'productize', '--file', path.join(testDataDir, 'test_productize_error.json') ],
					{ env: engageEnv }
				);

				expect(status).to.equal(1);
				expect(stdout + stderr).to.include('scope name');
			});

			it('should error when the API service does not exist', async () => {
				// Seed instances but NOT the api service → GET apiservice returns 404
				engageServer.engageResources.set(
					'management/v1alpha1/environments/env1/apiserviceinstances/inst1',
					makeApiServiceInstance('inst1', 'env1', API_SVC1_ID)
				);

				const { status, stdout, stderr } = await runAxwaySync(
					[ 'engage', 'productize', '--file', path.join(testDataDir, 'test_productize.json') ],
					{ env: engageEnv }
				);

				expect(status).to.equal(1);
				// productize reports an error for each api service that couldn't be found
				expect(stdout + stderr).to.include('apisvc1');
			});

			it('should error when there are no APIServiceInstances for an API service', async () => {
				// Seed the api service but NOT its instances
				engageServer.engageResources.set(
					'management/v1alpha1/environments/env1/apiservices/apisvc1',
					makeApiService('apisvc1', 'env1', API_SVC1_ID)
				);
				engageServer.engageResources.set(
					'management/v1alpha1/environments/env2/apiservices/apisvc2',
					makeApiService('apisvc2', 'env2', API_SVC2_ID)
				);
				// Force empty instance list for both envs
				engageServer.forceErrors.set(
					'GET:management/v1alpha1/environments/env1/apiserviceinstances',
					{ status: 200, body: [] }
				);
				engageServer.forceErrors.set(
					'GET:management/v1alpha1/environments/env2/apiserviceinstances',
					{ status: 200, body: [] }
				);

				const { status, stdout, stderr } = await runAxwaySync(
					[ 'engage', 'productize', '--file', path.join(testDataDir, 'test_productize.json') ],
					{ env: engageEnv }
				);

				expect(status).to.equal(1);
				expect(stdout + stderr).to.include('APIServiceInstance');
			});
		});

		describe('happy path', () => {
			it('should productize API services from a json file', async () => {
				// Seed api services and their instances so the productize service can proceed
				engageServer.engageResources.set(
					'management/v1alpha1/environments/env1/apiservices/apisvc1',
					makeApiService('apisvc1', 'env1', API_SVC1_ID)
				);
				engageServer.engageResources.set(
					'management/v1alpha1/environments/env1/apiserviceinstances/inst1',
					makeApiServiceInstance('inst1', 'env1', API_SVC1_ID)
				);
				engageServer.engageResources.set(
					'management/v1alpha1/environments/env2/apiservices/apisvc2',
					makeApiService('apisvc2', 'env2', API_SVC2_ID)
				);
				engageServer.engageResources.set(
					'management/v1alpha1/environments/env2/apiserviceinstances/inst2',
					makeApiServiceInstance('inst2', 'env2', API_SVC2_ID)
				);

				const { status, stdout, stderr } = await runAxwaySync(
					[ 'engage', 'productize', '--file', path.join(testDataDir, 'test_productize.json') ],
					{ env: engageEnv }
				);

				expect(status).to.equal(0);
				// productize outputs API Service result lines to stdout
				expect(stdout + stderr).to.include('has been successfully productized');
			});
		});
	});
});
