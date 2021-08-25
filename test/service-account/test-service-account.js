import {
	initHomeDir,
	renderRegexFromFile,
	resetHomeDir,
	runAxwaySync,
	startServers,
	stopServers
} from '../helpers';
import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';

tmp.setGracefulCleanup();

describe('axway service-account', () => {
	describe('help', () => {
		it('should output the help screen with color', async () => {
			const { status, stdout } = await runAxwaySync([ 'service-account' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('help/help'));
		});

		it('should output the help screen using --help flag', async () => {
			const { status, stdout } = await runAxwaySync([ 'service-account', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('help/help'));
		});
	});

	describe('list', () => {
		afterEach(stopServers);
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			const { status, stderr } = await runAxwaySync([ 'service-account', 'list' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('list/not-authenticated'));
		});

		it('should error if org not found', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'list', '--org', 'does_not_exist' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('list/bad-org'));
		});

		it('should list all service accounts', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			let { status, stdout } = await runAxwaySync([ 'service-account', 'list', '--org', '1000' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('list/foo-service-accounts'));

			({ status, stdout } = await runAxwaySync([ 'service-account', 'list', '--org', '2000' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('list/bar-service-accounts'));
		});

		it('should list all service accounts as JSON', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			let { status, stdout } = await runAxwaySync([ 'service-account', 'list', '--org', '1000', '--json' ]);
			expect(status).to.equal(0);
			let { clients } = JSON.parse(stdout.toString());
			expect(clients).to.deep.equal([
				{
					client_id: 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
					created: '2021-03-24T13:13:11.567Z',
					guid: '629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
					name: 'Test',
					org_guid: '1000',
					type: 'secret',
					method: 'Client Secret'
				}
			]);

			({ status, stdout } = await runAxwaySync([ 'service-account', 'list', '--org', '2000', '--json' ]));
			expect(status).to.equal(0);
			({ clients } = JSON.parse(stdout.toString()));
			expect(clients).to.deep.equal([]);
		});
	});

	describe('generate-keypair', () => {
		afterEach(resetHomeDir);

		it('should generate a keypair to specific file', async function () {
			initHomeDir('home-local');

			const tmpDir = tmp.tmpNameSync({ prefix: 'test-axway-cli-' });
			const publicKeyFile = path.join(tmpDir, 'public_key.pem');
			const privateKeyFile = path.join(tmpDir, 'private_key.pem');

			let { status } = await runAxwaySync([
				'service-account',
				'generate-keypair',
				'--public-key', publicKeyFile,
				'--private-key', privateKeyFile
			]);

			expect(status).to.equal(0);
			expect(fs.existsSync(publicKeyFile)).to.equal(true);
			expect(fs.readFileSync(publicKeyFile, 'utf-8')).to.include('-----BEGIN PUBLIC KEY-----');
			expect(fs.existsSync(privateKeyFile)).to.equal(true);
			expect(fs.readFileSync(privateKeyFile, 'utf-8')).to.include('-----BEGIN PRIVATE KEY-----');
		});

		it('should generate a keypair as JSON and to specific file', async function () {
			initHomeDir('home-local');

			const tmpDir = tmp.tmpNameSync({ prefix: 'test-axway-cli-' });
			const publicKeyFile = path.join(tmpDir, 'public_key.pem');
			const privateKeyFile = path.join(tmpDir, 'private_key.pem');

			let { status, stdout } = await runAxwaySync([
				'service-account',
				'generate-keypair',
				'--public-key', publicKeyFile,
				'--private-key', privateKeyFile,
				'--json'
			]);

			expect(status).to.equal(0);
			expect(fs.existsSync(publicKeyFile)).to.equal(true);
			expect(fs.readFileSync(publicKeyFile, 'utf-8')).to.include('-----BEGIN PUBLIC KEY-----');
			expect(fs.existsSync(privateKeyFile)).to.equal(true);
			expect(fs.readFileSync(privateKeyFile, 'utf-8')).to.include('-----BEGIN PRIVATE KEY-----');

			let result = JSON.parse(stdout.toString());
			expect(result).to.have.all.keys('publicKey', 'privateKey');
			expect(result.publicKey).to.have.all.keys('file', 'label', 'cert');
			expect(fs.existsSync(result.publicKey.file)).to.equal(true);
			expect(result.privateKey).to.have.all.keys('file', 'label', 'cert');
			expect(fs.existsSync(result.privateKey.file)).to.equal(true);

			({ status, stdout } = await runAxwaySync([
				'service-account',
				'generate-keypair',
				'--public-key', publicKeyFile,
				'--private-key', privateKeyFile,
				'--json'
			]));

			result = JSON.parse(stdout.toString());
			expect(status).to.equal(1);
			expect(result.code).to.equal(1);
			expect(result.result).to.match(/^Error: Private key file exists:/);

			({ status, stdout } = await runAxwaySync([
				'service-account',
				'generate-keypair',
				'--public-key', publicKeyFile,
				'--private-key', privateKeyFile,
				'--json',
				'--force'
			]));

			expect(status).to.equal(0);
			result = JSON.parse(stdout.toString());
			expect(result).to.have.all.keys('publicKey', 'privateKey');
			expect(result.publicKey).to.have.all.keys('file', 'label', 'cert');
			expect(fs.existsSync(result.publicKey.file)).to.equal(true);
			expect(result.privateKey).to.have.all.keys('file', 'label', 'cert');
			expect(fs.existsSync(result.privateKey.file)).to.equal(true);
		});
	});

	describe('roles', () => {
		afterEach(stopServers);
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			const { status, stderr } = await runAxwaySync([ 'service-account', 'roles' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('roles/not-authenticated'));
		});

		it('should error if org not found', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'roles', '--org', 'does_not_exist' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('roles/bad-org'));
		});

		it('should output available service account and team roles', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stdout } = await runAxwaySync([ 'service-account', 'roles' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('roles/roles'));
		});

		it('should output available service account and team roles as JSON', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stdout } = await runAxwaySync([ 'service-account', 'roles', '--json' ]);
			expect(status).to.equal(0);
			const result = JSON.parse(stdout.toString());
			expect(result.orgRoles).to.deep.equal([
				{
					client: true,
					id: 'some_admin',
					name: 'Some Admin',
					org: true
				}
			]);
			expect(result.teamRoles).to.deep.equal([
				{
					default: true,
					id: 'administrator',
					name: 'Administrator',
					org: true,
					team: true
				},
				{
					default: true,
					id: 'developer',
					name: 'Developer',
					org: true,
					team: true
				}
			]);
		});
	});

	describe('view', () => {
		afterEach(stopServers);
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			const { status, stderr } = await runAxwaySync([ 'service-account', 'view', 'Test' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('view/not-authenticated'));
		});

		it('should error if org not found', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'view', 'Test', '--org', 'does_not_exist' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('view/bad-org'));
		});

		it('should error if service account is not found', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'view', 'does_not_exist' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('view/not-found'));
		});

		it('should output a service account\'s info', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			let { status, stdout } = await runAxwaySync([ 'service-account', 'view', 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('view/test-service-account'));

			({ status, stdout } = await runAxwaySync([ 'service-account', 'view', 'Test' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('view/test-service-account'));
		});

		it('should output a service account\'s info as JSON', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const data = {
				client_id: 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
				created: '2021-03-24T13:13:11.567Z',
				guid: '629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
				name: 'Test',
				org_guid: '1000',
				roles: [ 'some_admin' ],
				type: 'secret',
				method: 'Client Secret',
				description: 'Test service account',
				teams: [
					{
						name: 'A Team',
						created: '2021-02-14T15:30:00.000Z',
						guid: '60000',
						default: true,
						tags: [],
						org_guid: '1000',
						users: [
							{
								guid: '50000',
								roles: [ 'administrator' ],
								type: 'user'
							},
							{
								guid: '629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
								type: 'client',
								roles: [ 'developer' ]
							}
						],
						roles: [ 'developer' ]
					}
				]
			};

			let { status, stdout } = await runAxwaySync([ 'service-account', 'view', 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad', '--json' ]);
			expect(status).to.equal(0);
			expect(JSON.parse(stdout.toString()).client).to.deep.equal(data);

			({ status, stdout } = await runAxwaySync([ 'service-account', 'view', 'Test', '--json' ]));
			expect(status).to.equal(0);
			expect(JSON.parse(stdout.toString()).client).to.deep.equal(data);
		});
	});

	describe('create', () => {
		afterEach(stopServers);
		afterEach(resetHomeDir);

		it('?', async function () {
			//
		});
	});

	describe('add-team', () => {
		afterEach(stopServers);
		afterEach(resetHomeDir);

		it('?', async function () {
			//
		});
	});

	describe('remove-team', () => {
		afterEach(stopServers);
		afterEach(resetHomeDir);

		it('?', async function () {
			//
		});
	});

	describe('update', () => {
		afterEach(stopServers);
		afterEach(resetHomeDir);

		it('?', async function () {
			//
		});
	});

	describe('remove', () => {
		afterEach(stopServers);
		afterEach(resetHomeDir);

		it('?', async function () {
			//
		});
	});
});
