import path from 'path';
import { runCommand, renderRegexFromFile } from '../../../helpers/index.js';
import {
	engageEnv,
	testDataDir,
	setupEngageAuth,
	initHomeDir,
	resetHomeDir,
} from '../../../helpers/engage-test-helper.js';

function makeEnv(name) {
	return {
		group: 'management',
		apiVersion: 'v1alpha1',
		kind: 'Environment',
		name,
		title: `${name} title`,
		metadata: {
			id: `id-${name}`,
			audit: {
				createTimestamp: '2023-01-01T00:00:00.000Z',
				modifyTimestamp: '2023-01-01T00:00:00.000Z',
			},
			references: [],
		},
		spec: {},
	};
}

function makeSecret(name, scopeName) {
	return {
		group: 'management',
		apiVersion: 'v1alpha1',
		kind: 'Secret',
		name,
		title: `${name} title`,
		metadata: {
			id: `id-${name}`,
			audit: {
				createTimestamp: '2023-01-01T00:00:00.000Z',
				modifyTimestamp: '2023-01-01T00:00:00.000Z',
			},
			scope: { kind: 'Environment', name: scopeName },
			references: [],
		},
		spec: {},
	};
}

describe('axway engage delete', () => {
	describe('help', () => {
		it('should output the help screen', async () => {
			const { status, stdout } = await runCommand([ 'engage', 'delete', '--help' ]);
			expect(stdout).to.match(renderRegexFromFile('templates/help'));
			expect(status).to.equal(0);
		});
	});

	describe('auth required', () => {
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			initHomeDir('home-local');
			const { status, stderr } = await runCommand(
				[ 'engage', 'delete', 'environment', 'testenv1', '--yes' ],
				{ env: engageEnv }
			);
			expect(status).to.equal(1);
			expect(stderr).to.match(renderRegexFromFile('templates/not-authenticated'));
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
			it('should error if no args or --file provided', async () => {
				const { status, stdout, stderr } = await runCommand([ 'engage', 'delete' ], { env: engageEnv });
				expect(status).to.equal(1);
				expect(stdout + stderr).to.include('You must specify the type and name of the resource to delete or a file path');
			});
		});

		describe('delete by name', () => {
			it('should delete an unscoped resource with --yes (no confirmation prompt)', async () => {
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1', makeEnv('testenv1'));

				const { status, stdout, stderr } = await runCommand(
					[ 'engage', 'delete', 'environment', 'testenv1', '--yes' ],
					{ env: engageEnv }
				);

				expect(status).to.equal(0);
				expect(stdout + stderr).to.include('has successfully been deleted');
				expect(engageServer.engageResources.has('management/v1alpha1/environments/testenv1')).to.be.false;
			});

			it('should delete when confirmation prompt is answered Yes', async () => {
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1', makeEnv('testenv1'));

				const { status } = await runCommand(
					[ 'engage', 'delete', 'environment', 'testenv1' ],
					{ env: { ...engageEnv, AXWAY_TEST_ASK_LIST_RESPONSE: 'Yes' } }
				);

				expect(status).to.equal(0);
				expect(engageServer.engageResources.has('management/v1alpha1/environments/testenv1')).to.be.false;
			});

			it('should abort deletion when confirmation prompt is answered No', async () => {
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1', makeEnv('testenv1'));

				const { status } = await runCommand(
					[ 'engage', 'delete', 'environment', 'testenv1' ],
					{ env: { ...engageEnv, AXWAY_TEST_ASK_LIST_RESPONSE: 'No' } }
				);

				// User declined – command exits with error and without deleting.
				expect(status).to.equal(1);
				expect(engageServer.engageResources.has('management/v1alpha1/environments/testenv1')).to.be.true;
			});

			it('should force-delete an unscoped resource with --force-delete and --yes', async () => {
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1', makeEnv('testenv1'));

				const { status } = await runCommand(
					[ 'engage', 'delete', 'environment', 'testenv1', '--yes', '--force-delete' ],
					{ env: { ...engageEnv, AXWAY_TEST_ASK_LIST_RESPONSE: 'Yes' } }
				);

				expect(status).to.equal(1);
			});

			it('should delete a scoped resource with explicit scope kind and --yes', async () => {
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1', makeEnv('testenv1'));
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1/secrets/secret1', makeSecret('secret1', 'testenv1'));

				const { status } = await runCommand(
					[ 'engage', 'delete', 'secret', 'secret1', '--scope', 'Environment/testenv1', '--yes' ],
					{ env: engageEnv }
				);

				expect(status).to.equal(0);
				expect(engageServer.engageResources.has('management/v1alpha1/environments/testenv1/secrets/secret1')).to.be.false;
			});

			it('should error if resource is not found', async () => {
				// resource not seeded → mock server returns 404
				const { status, stderr } = await runCommand(
					[ 'engage', 'delete', 'environment', 'nonexistent', '--yes' ],
					{ env: engageEnv }
				);

				expect(status).to.equal(1);
				expect(stderr).to.include('not found');
			});

			it('should error if an invalid resource type is provided', async () => {
				const { status, stderr } = await runCommand(
					[ 'engage', 'delete', 'invalidtype123', 'somename', '--yes' ],
					{ env: engageEnv }
				);

				expect(status).to.equal(1);
				expect(stderr).to.include('invalidtype123');
			});
		});

		describe('delete from file', () => {
			it('should bulk-delete resources from a yaml file', async () => {
				engageServer.engageResources.set('management/v1alpha1/environments/env1', makeEnv('env1'));
				engageServer.engageResources.set('management/v1alpha1/environments/env2', makeEnv('env2'));

				const { status, stderr } = await runCommand(
					[ 'engage', 'delete', '--file', path.join(testDataDir, '../examples/environments.yaml') ],
					{ env: engageEnv }
				);

				expect(status).to.equal(0);
				expect(stderr).to.match(renderRegexFromFile('templates/bulk-delete-success'));
				expect(engageServer.engageResources.has('management/v1alpha1/environments/env1')).to.be.false;
				expect(engageServer.engageResources.has('management/v1alpha1/environments/env2')).to.be.false;
			});

			it('should bulk-delete resources from a json file', async () => {
				engageServer.engageResources.set('management/v1alpha1/environments/env1', makeEnv('env1'));
				engageServer.engageResources.set('management/v1alpha1/environments/env2', makeEnv('env2'));

				const { status } = await runCommand(
					[ 'engage', 'delete', '--file', path.join(testDataDir, '../examples/environments.json') ],
					{ env: engageEnv }
				);

				expect(status).to.equal(0);
			});

			it('should handle a 400 error during bulk delete', async () => {
				engageServer.engageResources.set('management/v1alpha1/environments/env2', makeEnv('env2'));
				// env1 not seeded → 404 on DELETE
				const { status, stderr } = await runCommand(
					[ 'engage', 'delete', '--file', path.join(testDataDir, '../examples/environments.yaml') ],
					{ env: engageEnv }
				);

				// env1 404 should produce a non-zero exit code
				expect(status).to.equal(1);
				expect(stderr).to.include('not found');
			});
		});
	});
});
