import { runCommand, renderRegexFromFile } from '../../../helpers/index.js';
import {
	engageEnv,
	e500,
	setupEngageAuth,
	initHomeDir,
	resetHomeDir,
} from '../../../helpers/engage-test-helper.js';

// Minimal resource factories ─ provide only fields the CLI table / serializers need
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
				modifyTimestamp:  '2023-01-01T00:00:00.000Z',
			},
			references: [],
		},
		spec: {},
	};
}

function makeWebhook(name) {
	return {
		group: 'management',
		apiVersion: 'v1alpha1',
		kind: 'Webhook',
		name,
		title: `${name} title`,
		metadata: {
			id: `id-${name}`,
			audit: {
				createTimestamp: '2023-01-01T00:00:00.000Z',
				modifyTimestamp:  '2023-01-01T00:00:00.000Z',
			},
			references: [],
		},
		spec: {},
	};
}

function makeStage(name) {
	return {
		group: 'catalog',
		apiVersion: 'v1alpha1',
		kind: 'Stage',
		name,
		title: `${name} title`,
		metadata: {
			id: `id-${name}`,
			audit: {
				createTimestamp: '2023-01-01T00:00:00.000Z',
				modifyTimestamp:  '2023-01-01T00:00:00.000Z',
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
				modifyTimestamp:  '2023-01-01T00:00:00.000Z',
			},
			scope: { kind: 'Environment', name: scopeName },
			references: [],
		},
		spec: {},
	};
}

describe('axway engage get', () => {
	describe('help', () => {
		it('should output the help screen', async () => {
			const { status, stdout } = await runCommand([ 'engage', 'get', '--help' ]);
			expect(stdout).to.match(renderRegexFromFile('templates/help'));
			expect(status).to.equal(0);
		});
	});

	describe('auth required', () => {
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			initHomeDir('home-local');
			const { status, stderr } = await runCommand([ 'engage', 'get', 'environment' ], { env: engageEnv });
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
			it('should error if no resource type is provided', async () => {
				const { status, stdout } = await runCommand([ 'engage', 'get' ], { env: engageEnv });
				expect(status).to.equal(1);
				expect(stdout).to.match(renderRegexFromFile('templates/missing-resource-type'));
			});

			it('should error if an invalid resource type is provided', async () => {
				const { status, stderr } = await runCommand([ 'engage', 'get', 'invalidtype123' ], { env: engageEnv });
				expect(status).to.equal(1);
				expect(stderr).to.match(renderRegexFromFile('templates/invalid-resource-type'));
			});
		});

		describe('get list', () => {
			it('should list environments (management group) as a table', async () => {
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1', makeEnv('testenv1'));
				engageServer.engageResources.set('management/v1alpha1/environments/testenv2', makeEnv('testenv2'));

				const { status, stdout } = await runCommand([ 'engage', 'get', 'environment' ], { env: engageEnv });

				expect(status).to.equal(0);
				expect(stdout).to.include('testenv1');
				expect(stdout).to.include('testenv2');
			});

			it('should list webhooks using the "wh" shortName', async () => {
				engageServer.engageResources.set('management/v1alpha1/webhooks/webhook1', makeWebhook('webhook1'));
				engageServer.engageResources.set('management/v1alpha1/webhooks/webhook2', makeWebhook('webhook2'));

				const { status, stdout } = await runCommand([ 'engage', 'get', 'wh' ], { env: engageEnv });

				expect(status).to.equal(0);
				expect(stdout).to.include('webhook1');
				expect(stdout).to.include('webhook2');
			});

			it('should list catalog resources (stages) as a table', async () => {
				engageServer.engageResources.set('catalog/v1alpha1/stages/stage1', makeStage('stage1'));
				engageServer.engageResources.set('catalog/v1alpha1/stages/stage2', makeStage('stage2'));

				const { status, stdout } = await runCommand([ 'engage', 'get', 'stage' ], { env: engageEnv });

				expect(status).to.equal(0);
				expect(stdout).to.include('stage1');
				expect(stdout).to.include('stage2');
			});

			it('should list secrets scoped to an environment', async () => {
				// Seed the environment so the scope resolution succeeds
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1', makeEnv('testenv1'));
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1/secrets/secret1', makeSecret('secret1', 'testenv1'));
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1/secrets/secret2', makeSecret('secret2', 'testenv1'));

				const { status, stdout } = await runCommand(
					[ 'engage', 'get', 'secret', '--scope', 'Environment/testenv1' ],
					{ env: engageEnv }
				);

				expect(status).to.equal(0);
				expect(stdout).to.include('secret1');
				expect(stdout).to.include('secret2');
			});

			it('should list resources with --output yaml', async () => {
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1', makeEnv('testenv1'));

				const { status, stdout } = await runCommand(
					[ 'engage', 'get', 'environment', '--output', 'yaml' ],
					{ env: engageEnv }
				);

				expect(status).to.equal(0);
				expect(stdout).to.match(/kind:\s*Environment/);
				expect(stdout).to.include('testenv1');
			});

			it('should list resources with --output json', async () => {
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1', makeEnv('testenv1'));

				const { status, stdout } = await runCommand(
					[ 'engage', 'get', 'environment', '--output', 'json', '--no-banner' ],
					{ env: engageEnv }
				);

				expect(status).to.equal(0);
				const parsed = JSON.parse(stdout);
				expect(parsed).to.be.an('array');
				expect(JSON.stringify(parsed)).to.include('testenv1');
			});

			it('should list multiple comma-separated resource types', async () => {
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1', makeEnv('testenv1'));
				engageServer.engageResources.set('catalog/v1alpha1/stages/stage1', makeStage('stage1'));

				const { status, stdout } = await runCommand(
					[ 'engage', 'get', 'environment,stage' ],
					{ env: engageEnv }
				);

				// Multiple resources renders separate tables; both names should appear
				expect(status).to.equal(0);
				expect(stdout).to.include('testenv1');
				expect(stdout).to.include('stage1');
			});

			it('should return empty list message when no resources are found', async () => {
				// Nothing seeded — list returns empty array
				const { status, stdout } = await runCommand([ 'engage', 'get', 'environment' ], { env: engageEnv });

				expect(status).to.equal(0);
				expect(stdout).to.include('No resources found.');
			});
		});

		describe('get by name', () => {
			it('should get a specific environment by name as a table', async () => {
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1', makeEnv('testenv1'));

				const { status, stdout } = await runCommand(
					[ 'engage', 'get', 'environment', 'testenv1' ],
					{ env: engageEnv }
				);

				expect(status).to.equal(0);
				expect(stdout).to.include('testenv1');
			});

			it('should get a specific environment by name with --output yaml', async () => {
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1', makeEnv('testenv1'));

				const { status, stdout } = await runCommand(
					[ 'engage', 'get', 'environment', 'testenv1', '--output', 'yaml' ],
					{ env: engageEnv }
				);

				expect(status).to.equal(0);
				expect(stdout).to.match(/kind:\s*Environment/);
				expect(stdout).to.include('testenv1');
			});

			it('should get a specific environment by name with --output json', async () => {
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1', makeEnv('testenv1'));

				const { status, stdout } = await runCommand(
					[ 'engage', 'get', 'environment', 'testenv1', '--output', 'json', '--no-banner' ],
					{ env: engageEnv }
				);

				expect(status).to.equal(0);
				const parsed = JSON.parse(stdout);
				expect(JSON.stringify(parsed)).to.include('testenv1');
			});

			it('should get a scoped resource by name', async () => {
				engageServer.engageResources.set('management/v1alpha1/environments/testenv1/secrets/secret1', makeSecret('secret1', 'testenv1'));

				const { status, stdout } = await runCommand(
					[ 'engage', 'get', 'secret', 'secret1', '--scope', 'Environment/testenv1' ],
					{ env: engageEnv }
				);

				expect(status).to.equal(0);
				expect(stdout).to.include('secret1');
			});
		});

		describe('error cases', () => {
			it('should show error when a resource is not found (404)', async () => {
				// testenv1 is not seeded → natural 404 from the mock server
				const { status, stderr } = await runCommand(
					[ 'engage', 'get', 'environment', 'testenv1' ],
					{ env: engageEnv }
				);

				expect(status).to.equal(1);
				expect(stderr).to.match(renderRegexFromFile('templates/not-found-error'));
			});

			it('should show error on server error (500)', async () => {
				engageServer.forceErrors.set('GET:management/v1alpha1/environments', { status: 500, body: e500 });

				const { status, stderr } = await runCommand([ 'engage', 'get', 'environment' ], { env: engageEnv });

				expect(status).to.equal(1);
				expect(stderr).to.match(renderRegexFromFile('templates/server-error'));
			});
		});
	});
});
