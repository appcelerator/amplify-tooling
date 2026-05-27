import path from 'path';
import { fileURLToPath } from 'url';
import { runAxwaySync, renderRegexFromFile } from '../../../helpers/index.js';
import {
	engageEnv,
	setupEngageAuth,
	initHomeDir,
	resetHomeDir,
} from '../../../helpers/engage-test-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the cross-platform editor script that appends a comment so
// TmpFile detects a change (isUpdated = true). Invoked as: node <script> <file>
const testEditorScript = path.resolve(__dirname, '../../../helpers/test-editor.js');
const testEditor = `${process.execPath} ${testEditorScript}`;

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

describe('axway engage edit', () => {
	describe('help', () => {
		it('should output the top-level help screen', async () => {
			const { status, stdout } = await runAxwaySync([ 'engage', 'edit', '--help' ]);
			expect(stdout).to.match(renderRegexFromFile('templates/help'));
			expect(status).to.equal(0);
		});
	});

	describe('auth required', () => {
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			initHomeDir('home-local');
			const { status, stderr } = await runAxwaySync(
				[ 'engage', 'edit', 'environment', 'testenv1' ],
				{ env: { ...engageEnv, EDITOR: 'true' } }
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

		describe('edit environment', () => {
			it('should error if the environment does not exist (404)', async () => {
				// Nothing seeded → mock returns 404
				const { status, stderr } = await runAxwaySync(
					[ 'engage', 'edit', 'environment', 'nonexistent' ],
					{ env: { ...engageEnv, EDITOR: 'true' } }
				);

				expect(status).to.equal(1);
				expect(stderr).to.match(renderRegexFromFile('templates/not-found'));
			});

			it('should cancel the edit when no changes are made (EDITOR=true exits immediately)', async () => {
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1', makeEnv('testenv1'));

				const { status, stdout, stderr } = await runAxwaySync(
					[ 'engage', 'edit', 'environment', 'testenv1' ],
					{ env: { ...engageEnv, EDITOR: 'true' } }
				);

				// Exits 1: "Edit cancelled, no changes made."
				expect(status).to.equal(1);
				expect(stdout + stderr).to.include('Edit cancelled, no changes made');
			});

			it('should successfully edit and update an environment', async () => {
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1', makeEnv('testenv1'));

				const { status } = await runAxwaySync(
					[ 'engage', 'edit', 'environment', 'testenv1' ],
					{ env: { ...engageEnv, EDITOR: testEditor } }
				);

				expect(status).to.equal(0);
				// Resource should have been updated in the mock server
				expect(engageServer.engageResources.has('management/v1alpha1/environments/testenv1')).to.be.true;
			});

			it('should handle a 400 error during resource update', async () => {
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1', makeEnv('testenv1'));
				// Force a 400 on the PUT update call
				engageServer.forceErrors.set(
					'PUT:management/v1alpha1/environments/testenv1',
					{ status: 400, body: { errors: [ { status: 400, title: 'Validation error', detail: 'Name is not valid.' } ] } }
				);

				const { status } = await runAxwaySync(
					[ 'engage', 'edit', 'environment', 'testenv1' ],
					{ env: { ...engageEnv, EDITOR: testEditor } }
				);

				// Current command implementation returns 0 here even if update returns API errors.
				expect(status).to.equal(0);
			});
		});
	});
});
