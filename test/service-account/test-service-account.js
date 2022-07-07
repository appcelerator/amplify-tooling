import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';
import { expect } from 'chai';
import { fileURLToPath } from 'url';
import {
	initHomeDir,
	renderRegexFromFile,
	resetHomeDir,
	runAxwaySync,
	startServers,
	stopServers
} from '../helpers/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

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
					roles: [ 'some_admin' ],
					type: 'secret',
					method: 'Client Secret'
				}
			]);

			({ status, stdout } = await runAxwaySync([ 'service-account', 'list', '--org', '2000', '--json' ]));
			expect(status).to.equal(0);
			({ clients } = JSON.parse(stdout.toString()));
			expect(clients).to.deep.equal([]);
		});

		it('should output list help', async () => {
			const { status, stdout } = await runAxwaySync([ 'service-account', 'list', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('list/help'));
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
				'--yes'
			]));

			expect(status).to.equal(0);
			result = JSON.parse(stdout.toString());
			expect(result).to.have.all.keys('publicKey', 'privateKey');
			expect(result.publicKey).to.have.all.keys('file', 'label', 'cert');
			expect(fs.existsSync(result.publicKey.file)).to.equal(true);
			expect(result.privateKey).to.have.all.keys('file', 'label', 'cert');
			expect(fs.existsSync(result.privateKey.file)).to.equal(true);
		});

		it('should output generate-keypair help', async () => {
			const { status, stdout } = await runAxwaySync([ 'service-account', 'generate-keypair', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('generate-keypair/help'));
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

		it('should output roles help', async () => {
			const { status, stdout } = await runAxwaySync([ 'service-account', 'roles', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('roles/help'));
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

		it('should output view help', async () => {
			const { status, stdout } = await runAxwaySync([ 'service-account', 'view', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('view/help'));
		});
	});

	describe('create', () => {
		afterEach(stopServers);
		afterEach(resetHomeDir);

		it('should show help if prompting is not available', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stdout } = await runAxwaySync([ 'service-account', 'create' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('create/help'));
		});

		it('should error if org is invalid', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'create', '--org', 'does_not_exist' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('create/bad-org'));
		});

		it('should create a new service account with client secret', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stdout } = await runAxwaySync([ 'service-account', 'create', '--name', 'foo', '--secret', 'bar' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('create/foo-success'));
		});

		it('should create a new service account with client secret, desc, and role', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			let { status, stdout } = await runAxwaySync([
				'service-account',
				'create',
				'--name', 'bar',
				'--desc', 'Bar works',
				'--role', 'some_admin',
				'--secret', 'shhh'
			]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('create/bar-success'));

			const m = stdout.toString().match(/Client ID:\s+\u001b\[36m(bar_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\u001b\[39m/);
			const clientId = m[1];

			({ status, stdout } = await runAxwaySync([ 'service-account', 'view', clientId ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('create/view-bar'));
		});

		it('should create a new service account with public key', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stdout } = await runAxwaySync([ 'service-account', 'create', '--name', 'foo', '--public-key', path.join(__dirname, 'public_key.pem') ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('create/foo-success-cert'));
		});

		it('should error if secret or public key are not specified', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'create', '--name', 'foo' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('create/no-auth-method'));
		});

		it('should error if public key is invalid', async function () {
			this.timeout(30000);
			this.slow(15000);

			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			let { status, stderr } = await runAxwaySync([ 'service-account', 'create', '--name', 'foo', '--public-key', path.join(__dirname, 'does_not_exist.pem') ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('create/public-key-not-found'));

			({ status, stderr } = await runAxwaySync([ 'service-account', 'create', '--name', 'foo', '--public-key', __dirname ]));
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('create/public-key-not-a-file'));

			({ status, stderr } = await runAxwaySync([ 'service-account', 'create', '--name', 'foo', '--public-key', path.join(__dirname, 'bad_key.pem') ]));
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('create/bad-public-key'));
		});

		it('should output create help', async () => {
			const { status, stdout } = await runAxwaySync([ 'service-account', 'create', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('create/help'));
		});
	});

	describe('add-team', () => {
		afterEach(stopServers);
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			const { status, stderr } = await runAxwaySync([ 'service-account', 'add-team', 'a', 'b', 'c' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('add-team/not-authenticated'));
		});

		it('should error if org not found', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'add-team', 'a', 'b', 'c', '--org', 'does_not_exist' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('add-team/bad-org'));
		});

		it('should error if service account name not specified', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'add-team' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('add-team/missing-id'));
		});

		it('should error if team not specified', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'add-team', 'foo' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('add-team/missing-team'));
		});

		it('should error if role not specified', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'add-team', 'foo', 'administrator' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('add-team/missing-role'));
		});

		it('should error if service account is not found', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'add-team', 'does_not_exist', 'foo', 'administrator' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('add-team/service-account-not-found'));
		});

		it('should error if team not found', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'add-team', 'Test', 'foo', 'administrator' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('add-team/team-not-found'));
		});

		it('should error if role is invalid', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'add-team', 'Test', 'A Team', 'bar' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('add-team/invalid-role'));
		});

		it('should add a team to a service account', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			await runAxwaySync([ 'team', 'create', '1000', 'Test Team' ]);

			let { status, stdout } = await runAxwaySync([ 'service-account', 'add-team', 'Test', 'Test Team', 'administrator' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('add-team/success'));

			({ stdout } = await runAxwaySync([ 'service-account', 'view', 'Test', '--json' ]));
			const result = JSON.parse(stdout.toString());
			expect(result.client.teams).to.have.lengthOf(2);
		});

		it('should output add-team help', async () => {
			const { status, stdout } = await runAxwaySync([ 'service-account', 'add-team', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('add-team/help'));
		});
	});

	describe('remove-team', () => {
		afterEach(stopServers);
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			const { status, stderr } = await runAxwaySync([ 'service-account', 'remove-team', 'a', 'b' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('remove-team/not-authenticated'));
		});

		it('should error if org not found', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'remove-team', 'a', 'b', '--org', 'does_not_exist' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('remove-team/bad-org'));
		});

		it('should error if service account name not specified', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'remove-team' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('remove-team/missing-id'));
		});

		it('should error if team not specified', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'remove-team', 'foo' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('remove-team/missing-team'));
		});

		it('should error if service account is not found', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'remove-team', 'does_not_exist', 'foo' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('remove-team/service-account-not-found'));
		});

		it('should error if team not found', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'remove-team', 'Test', 'foo' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('remove-team/team-not-found'));
		});

		it('should remove a service account', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			let { status, stdout } = await runAxwaySync([ 'service-account', 'remove-team', 'Test', 'A Team' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('remove-team/success'));

			({ stdout } = await runAxwaySync([ 'service-account', 'view', 'Test', '--json' ]));
			const result = JSON.parse(stdout.toString());
			expect(result.client.teams).to.have.lengthOf(0);
		});

		it('should output remove-team help', async () => {
			const { status, stdout } = await runAxwaySync([ 'service-account', 'remove-team', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('remove-team/help'));
		});
	});

	describe('update', () => {
		afterEach(stopServers);
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			const { status, stderr } = await runAxwaySync([ 'service-account', 'update', 'Test' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('update/not-authenticated'));
		});

		it('should error if org not found', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'update', 'Test', '--org', 'does_not_exist' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('update/bad-org'));
		});

		it('should error if service account is not found', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'update', 'does_not_exist' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('update/not-found'));
		});

		it('should error if public key is invalid', async function () {
			this.timeout(30000);
			this.slow(15000);

			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			let { status, stderr } = await runAxwaySync([ 'service-account', 'update', 'Test', '--public-key', path.join(__dirname, 'does_not_exist.pem') ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('update/public-key-not-found'));

			({ status, stderr } = await runAxwaySync([ 'service-account', 'update', 'Test', '--public-key', __dirname ]));
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('update/public-key-not-a-file'));

			({ status, stderr } = await runAxwaySync([ 'service-account', 'update', 'Test', '--public-key', path.join(__dirname, 'bad_key.pem') ]));
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('update/bad-public-key'));
		});

		it('should error if auth method is changed', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'update', 'Test', '--public-key', path.join(__dirname, 'public_key.pem') ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('update/change-auth-method'));
		});

		it('should update a service account', async function () {
			this.timeout(60000);
			this.slow(30000);

			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			let { status, stdout } = await runAxwaySync([ 'service-account', 'update', 'Test', '--name', 'Test2', '--desc', 'Test 2 is cool', '--role', '--secret', '123abc' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('update/success'));

			({ stdout } = await runAxwaySync([ 'service-account', 'view', 'Test2' ]));
			expect(stdout.toString()).to.match(renderRegexFromFile('update/view-after'));
		});

		it('should output update help', async () => {
			const { status, stdout } = await runAxwaySync([ 'service-account', 'update', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('update/help'));
		});
	});

	describe('remove', () => {
		afterEach(stopServers);
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			const { status, stderr } = await runAxwaySync([ 'service-account', 'remove', 'Test' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('remove/not-authenticated'));
		});

		it('should error if org not found', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'remove', 'Test', '--org', 'does_not_exist' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('remove/bad-org'));
		});

		it('should error if service account is not found', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'service-account', 'remove', 'does_not_exist' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('remove/not-found'));
		});

		it('should remove a service account by name', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			let { status, stdout } = await runAxwaySync([ 'service-account', 'remove', 'Test' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('remove/by-name-success'));

			({ stdout } = await runAxwaySync([ 'service-account', 'list', '--json']));
			expect(JSON.parse(stdout).clients.length).to.equal(0);
		});

		it('should remove a service account by client id', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			let { status, stdout } = await runAxwaySync([ 'service-account', 'remove', 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('remove/by-id-success'));

			({ stdout } = await runAxwaySync([ 'service-account', 'list', '--json']));
			expect(JSON.parse(stdout).clients.length).to.equal(0);
		});

		it('should remove a service account by client id as JSON', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			let { status, stdout } = await runAxwaySync([ 'service-account', 'remove', 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad', '--json' ]);
			expect(status).to.equal(0);
			const result = JSON.parse(stdout.toString())
			expect(result.client.name).to.equal('Test');
			expect(result.client.client_id).to.equal('test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad');

			({ stdout } = await runAxwaySync([ 'service-account', 'list', '--json']));
			expect(JSON.parse(stdout).clients.length).to.equal(0);
		});

		it('should output remove help', async () => {
			const { status, stdout } = await runAxwaySync([ 'service-account', 'remove', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('remove/help'));
		});
	});
});
