import {
	initHomeDir,
	loginCLISync,
	renderRegexFromFile,
	resetHomeDir,
	runAxwaySync
} from '../../helpers/index.js';
import fs from 'fs';
import path from 'path';
import tmp from 'tmp';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

tmp.setGracefulCleanup();

describe('axway service-account', () => {
	describe('help', () => {
		it('should output the help screen with color', async () => {
			const { status, stdout } = await runAxwaySync(['service-account']);
			expect(stdout).to.match(renderRegexFromFile('help/help'));
			expect(status).to.equal(2);
		});

		it('should output the help screen using --help flag', async () => {
			const { status, stdout } = await runAxwaySync(['service-account', '--help']);
			expect(stdout).to.match(renderRegexFromFile('help/help'));
			expect(status).to.equal(2);
		});
	});

	describe('list', () => {
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			const { status, stderr } = await runAxwaySync(['service-account', 'list']);
			expect(stderr.toString()).to.match(renderRegexFromFile('list/not-authenticated'));
			expect(status).to.equal(1);
		});

		it('should error if org not found', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'list', '--org', 'does_not_exist']);
			expect(stderr.toString()).to.match(renderRegexFromFile('list/bad-org'));
			expect(status).to.equal(1);
		});

		it('should list all service accounts', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			let { status, stdout } = await runAxwaySync(['service-account', 'list', '--org', '1000']);
			expect(stdout.toString()).to.match(renderRegexFromFile('list/foo-service-accounts'));
			expect(status).to.equal(0);
		});

		it('should list all service accounts as JSON', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			let { status, stdout } = await runAxwaySync(['service-account', 'list', '--json']);
			let { clients } = JSON.parse(stdout.toString());
			expect(clients).to.deep.equal([
				{
					client_id: 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
					created: '2021-03-24T13:13:11.567Z',
					guid: '629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
					name: 'Test',
					org_guid: '1000',
					roles: ['some_admin'],
					type: 'secret',
					method: 'Client Secret'
				},
				{
					client_id: 'test-auth-client-secret',
					created: '2025-10-01T13:37:00.567Z',
					guid: '2c033616-d195-4a2e-9562-568f5ec71821',
					method: 'Client Secret',
					name: 'Test Client Secret',
					org_guid: '1000',
					roles: [
						'administrator'
					],
					type: 'secret'
				}
			]);
			expect(status).to.equal(0);
		});

		it('should output list help', async () => {
			const { status, stdout } = await runAxwaySync(['service-account', 'list', '--help']);
			expect(stdout).to.match(renderRegexFromFile('list/help'));
			expect(status).to.equal(2);
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

			expect(fs.existsSync(publicKeyFile)).to.equal(true);
			expect(fs.readFileSync(publicKeyFile, 'utf-8')).to.include('-----BEGIN PUBLIC KEY-----');
			expect(fs.existsSync(privateKeyFile)).to.equal(true);
			expect(fs.readFileSync(privateKeyFile, 'utf-8')).to.include('-----BEGIN PRIVATE KEY-----');
			expect(status).to.equal(0);
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

			expect(fs.existsSync(publicKeyFile)).to.equal(true);
			expect(fs.readFileSync(publicKeyFile, 'utf-8')).to.include('-----BEGIN PUBLIC KEY-----');
			expect(fs.existsSync(privateKeyFile)).to.equal(true);
			expect(fs.readFileSync(privateKeyFile, 'utf-8')).to.include('-----BEGIN PRIVATE KEY-----');
			expect(status).to.equal(0);

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
			expect(result.code).to.equal(1);
			expect(result.result).to.match(/^Error: Private key file exists:/);
			expect(status).to.equal(1);

			({ status, stdout } = await runAxwaySync([
				'service-account',
				'generate-keypair',
				'--public-key', publicKeyFile,
				'--private-key', privateKeyFile,
				'--json',
				'--yes'
			]));

			result = JSON.parse(stdout.toString());
			expect(result).to.have.all.keys('publicKey', 'privateKey');
			expect(result.publicKey).to.have.all.keys('file', 'label', 'cert');
			expect(fs.existsSync(result.publicKey.file)).to.equal(true);
			expect(result.privateKey).to.have.all.keys('file', 'label', 'cert');
			expect(fs.existsSync(result.privateKey.file)).to.equal(true);
			expect(status).to.equal(0);
		});

		it('should output generate-keypair help', async () => {
			const { status, stdout } = await runAxwaySync(['service-account', 'generate-keypair', '--help']);
			expect(stdout).to.match(renderRegexFromFile('generate-keypair/help'));
			expect(status).to.equal(2);
		});
	});

	describe('roles', () => {
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			const { status, stderr } = await runAxwaySync(['service-account', 'roles']);
			expect(stderr.toString()).to.match(renderRegexFromFile('roles/not-authenticated'));
			expect(status).to.equal(1);
		});

		it('should error if org not found', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'roles', '--org', 'does_not_exist']);
			expect(stderr.toString()).to.match(renderRegexFromFile('roles/bad-org'));
			expect(status).to.equal(1);
		});

		it('should output available service account and team roles', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stdout } = await runAxwaySync(['service-account', 'roles']);
			expect(stdout.toString()).to.match(renderRegexFromFile('roles/roles'));
			expect(status).to.equal(0);
		});

		it('should output available service account and team roles as JSON', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stdout } = await runAxwaySync(['service-account', 'roles', '--json']);
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
			expect(status).to.equal(0);
		});

		it('should output roles help', async () => {
			const { status, stdout } = await runAxwaySync(['service-account', 'roles', '--help']);
			expect(stdout).to.match(renderRegexFromFile('roles/help'));
			expect(status).to.equal(2);
		});
	});

	describe('view', () => {
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			const { status, stderr } = await runAxwaySync(['service-account', 'view', 'Test']);
			expect(stderr.toString()).to.match(renderRegexFromFile('view/not-authenticated'));
			expect(status).to.equal(1);
		});

		it('should error if org not found', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'view', 'Test', '--org', 'does_not_exist']);
			expect(stderr.toString()).to.match(renderRegexFromFile('view/bad-org'));
			expect(status).to.equal(1);
		});

		it('should error if service account is not found', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'view', 'does_not_exist']);
			expect(stderr.toString()).to.match(renderRegexFromFile('view/not-found'));
			expect(status).to.equal(1);
		});

		it('should output a service account\'s info', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			let { status, stdout } = await runAxwaySync(['service-account', 'view', 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad']);
			expect(stdout.toString()).to.match(renderRegexFromFile('view/test-service-account'));
			expect(status).to.equal(0);

			({ status, stdout } = await runAxwaySync(['service-account', 'view', 'Test']));
			expect(stdout.toString()).to.match(renderRegexFromFile('view/test-service-account'));
			expect(status).to.equal(0);
		});

		it('should output a service account\'s info as JSON', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const data = {
				client_id: 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
				created: '2021-03-24T13:13:11.567Z',
				guid: '629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
				name: 'Test',
				org_guid: '1000',
				roles: ['some_admin'],
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
								roles: ['administrator'],
								type: 'user'
							},
							{
								guid: '629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
								type: 'client',
								roles: ['developer']
							}
						],
						roles: ['developer']
					}
				]
			};

			let { status, stdout } = await runAxwaySync(['service-account', 'view', 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad', '--json']);
			expect(JSON.parse(stdout.toString()).client).to.deep.equal(data);
			expect(status).to.equal(0);

			({ status, stdout } = await runAxwaySync(['service-account', 'view', 'Test', '--json']));
			expect(JSON.parse(stdout.toString()).client).to.deep.equal(data);
			expect(status).to.equal(0);
		});

		it('should output view help', async () => {
			const { status, stdout } = await runAxwaySync(['service-account', 'view', '--help']);
			expect(stdout).to.match(renderRegexFromFile('view/help'));
			expect(status).to.equal(2);
		});
	});

	describe('create', () => {
		afterEach(resetHomeDir);

		it('should show help if prompting is not available', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stdout } = await runAxwaySync(['service-account', 'create']);
			expect(stdout).to.match(renderRegexFromFile('create/help'));
			expect(status).to.equal(0);
		});

		it('should error if org is invalid', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'create', '--org', 'does_not_exist']);
			expect(stderr.toString()).to.match(renderRegexFromFile('create/bad-org'));
			expect(status).to.equal(1);
		});

		it('should create a new service account with client secret', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stdout } = await runAxwaySync(['service-account', 'create', '--name', 'foo', '--secret', 'bar']);
			expect(stdout.toString()).to.match(renderRegexFromFile('create/foo-success'));
			expect(status).to.equal(0);
		});

		it('should create a new service account with client secret, desc, and role', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			let { status, stdout } = await runAxwaySync([
				'service-account',
				'create',
				'--name', 'bar',
				'--desc', 'Bar works',
				'--role', 'some_admin',
				'--secret', 'shhh'
			]);
			expect(stdout.toString()).to.match(renderRegexFromFile('create/bar-success'));
			expect(status).to.equal(0);

			const m = stdout.toString().match(/Client ID:\s+\u001b\[36m(bar_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\u001b\[39m/);
			const clientId = m[1];

			({ status, stdout } = await runAxwaySync(['service-account', 'view', clientId]));
			expect(stdout.toString()).to.match(renderRegexFromFile('create/view-bar'));
			expect(status).to.equal(0);
		});

		it('should create a new service account with public key', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stdout } = await runAxwaySync(['service-account', 'create', '--name', 'foo', '--public-key', path.join(__dirname, 'public_key.pem')]);
			expect(stdout.toString()).to.match(renderRegexFromFile('create/foo-success-cert'));
			expect(status).to.equal(0);
		});

		it('should error if secret or public key are not specified', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'create', '--name', 'foo']);
			expect(stderr.toString()).to.match(renderRegexFromFile('create/no-auth-method'));
			expect(status).to.equal(1);
		});

		it('should error if public key is invalid', async function () {
			this.timeout(30000);
			this.slow(15000);

			initHomeDir('home-local');
			await loginCLISync();

			let { status, stderr } = await runAxwaySync(['service-account', 'create', '--name', 'foo', '--public-key', path.join(__dirname, 'does_not_exist.pem')]);
			expect(stderr.toString()).to.match(renderRegexFromFile('create/public-key-not-found'));
			expect(status).to.equal(1);

			({ status, stderr } = await runAxwaySync(['service-account', 'create', '--name', 'foo', '--public-key', __dirname]));
			expect(stderr.toString()).to.match(renderRegexFromFile('create/public-key-not-a-file'));
			expect(status).to.equal(1);

			({ status, stderr } = await runAxwaySync(['service-account', 'create', '--name', 'foo', '--public-key', path.join(__dirname, 'bad_key.pem')]));
			expect(stderr.toString()).to.match(renderRegexFromFile('create/bad-public-key'));
			expect(status).to.equal(1);
		});

		it('should output create help', async () => {
			const { status, stdout } = await runAxwaySync(['service-account', 'create', '--help']);
			expect(stdout).to.match(renderRegexFromFile('create/help'));
			expect(status).to.equal(2);
		});
	});

	describe('add-team', () => {
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			const { status, stderr } = await runAxwaySync(['service-account', 'add-team', 'a', 'b', 'c']);
			expect(stderr.toString()).to.match(renderRegexFromFile('add-team/not-authenticated'));
			expect(status).to.equal(1);
		});

		it('should error if org not found', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'add-team', 'a', 'b', 'c', '--org', 'does_not_exist']);
			expect(stderr.toString()).to.match(renderRegexFromFile('add-team/bad-org'));
			expect(status).to.equal(1);
		});

		it('should error if service account name not specified', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'add-team']);
			expect(stderr.toString()).to.match(renderRegexFromFile('add-team/missing-id'));
			expect(status).to.equal(1);
		});

		it('should error if team not specified', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'add-team', 'foo']);
			expect(stderr.toString()).to.match(renderRegexFromFile('add-team/missing-team'));
			expect(status).to.equal(1);
		});

		it('should error if role not specified', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'add-team', 'foo', 'administrator']);
			expect(stderr.toString()).to.match(renderRegexFromFile('add-team/missing-role'));
			expect(status).to.equal(1);
		});

		it('should error if service account is not found', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'add-team', 'does_not_exist', 'foo', 'administrator']);
			expect(stderr.toString()).to.match(renderRegexFromFile('add-team/service-account-not-found'));
			expect(status).to.equal(1);
		});

		it('should error if team not found', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'add-team', 'Test', 'foo', 'administrator']);
			expect(stderr.toString()).to.match(renderRegexFromFile('add-team/team-not-found'));
			expect(status).to.equal(1);
		});

		it('should error if role is invalid', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'add-team', 'Test', 'A Team', 'bar']);
			expect(stderr.toString()).to.match(renderRegexFromFile('add-team/invalid-role'));
			expect(status).to.equal(1);
		});

		it('should add a team to a service account', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			await runAxwaySync(['team', 'create', '1000', 'Test Team']);

			let { status, stdout } = await runAxwaySync(['service-account', 'add-team', 'Test', 'Test Team', 'administrator']);
			expect(stdout.toString()).to.match(renderRegexFromFile('add-team/success'));
			expect(status).to.equal(0);

			({ stdout } = await runAxwaySync(['service-account', 'view', 'Test', '--json']));
			const result = JSON.parse(stdout.toString());
			expect(result.client.teams).to.have.lengthOf(2);
		});

		it('should output add-team help', async () => {
			const { status, stdout } = await runAxwaySync(['service-account', 'add-team', '--help']);
			expect(stdout).to.match(renderRegexFromFile('add-team/help'));
			expect(status).to.equal(2);
		});
	});

	describe('remove-team', () => {
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			const { status, stderr } = await runAxwaySync(['service-account', 'remove-team', 'a', 'b']);
			expect(stderr.toString()).to.match(renderRegexFromFile('remove-team/not-authenticated'));
			expect(status).to.equal(1);
		});

		it('should error if org not found', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'remove-team', 'a', 'b', '--org', 'does_not_exist']);
			expect(stderr.toString()).to.match(renderRegexFromFile('remove-team/bad-org'));
			expect(status).to.equal(1);
		});

		it('should error if service account name not specified', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'remove-team']);
			expect(stderr.toString()).to.match(renderRegexFromFile('remove-team/missing-id'));
			expect(status).to.equal(1);
		});

		it('should error if team not specified', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'remove-team', 'foo']);
			expect(stderr.toString()).to.match(renderRegexFromFile('remove-team/missing-team'));
			expect(status).to.equal(1);
		});

		it('should error if service account is not found', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'remove-team', 'does_not_exist', 'foo']);
			expect(stderr.toString()).to.match(renderRegexFromFile('remove-team/service-account-not-found'));
			expect(status).to.equal(1);
		});

		it('should error if team not found', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'remove-team', 'Test', 'foo']);
			expect(stderr.toString()).to.match(renderRegexFromFile('remove-team/team-not-found'));
			expect(status).to.equal(1);
		});

		it('should remove a service account', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			let { status, stdout } = await runAxwaySync(['service-account', 'remove-team', 'Test', 'A Team']);
			expect(stdout.toString()).to.match(renderRegexFromFile('remove-team/success'));
			expect(status).to.equal(0);

			({ stdout } = await runAxwaySync(['service-account', 'view', 'Test', '--json']));
			const result = JSON.parse(stdout.toString());
			expect(result.client.teams).to.have.lengthOf(0);
		});

		it('should output remove-team help', async () => {
			const { status, stdout } = await runAxwaySync(['service-account', 'remove-team', '--help']);
			expect(stdout).to.match(renderRegexFromFile('remove-team/help'));
			expect(status).to.equal(2);
		});
	});

	describe('update', () => {
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			const { status, stderr } = await runAxwaySync(['service-account', 'update', 'Test']);
			expect(stderr.toString()).to.match(renderRegexFromFile('update/not-authenticated'));
			expect(status).to.equal(1);
		});

		it('should error if org not found', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'update', 'Test', '--org', 'does_not_exist']);
			expect(stderr.toString()).to.match(renderRegexFromFile('update/bad-org'));
			expect(status).to.equal(1);
		});

		it('should error if service account is not found', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'update', 'does_not_exist']);
			expect(stderr.toString()).to.match(renderRegexFromFile('update/not-found'));
			expect(status).to.equal(1);
		});

		it('should error if public key is invalid', async function () {
			this.timeout(30000);
			this.slow(15000);

			initHomeDir('home-local');
			await loginCLISync();

			let { status, stderr } = await runAxwaySync(['service-account', 'update', 'Test', '--public-key', path.join(__dirname, 'does_not_exist.pem')]);
			expect(stderr.toString()).to.match(renderRegexFromFile('update/public-key-not-found'));
			expect(status).to.equal(1);

			({ status, stderr } = await runAxwaySync(['service-account', 'update', 'Test', '--public-key', __dirname]));
			expect(stderr.toString()).to.match(renderRegexFromFile('update/public-key-not-a-file'));
			expect(status).to.equal(1);

			({ status, stderr } = await runAxwaySync(['service-account', 'update', 'Test', '--public-key', path.join(__dirname, 'bad_key.pem')]));
			expect(stderr.toString()).to.match(renderRegexFromFile('update/bad-public-key'));
			expect(status).to.equal(1);
		});

		it('should error if auth method is changed', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'update', 'Test', '--public-key', path.join(__dirname, 'public_key.pem')]);
			expect(stderr.toString()).to.match(renderRegexFromFile('update/change-auth-method'));
			expect(status).to.equal(1);
		});

		it('should update a service account', async function () {
			this.timeout(60000);
			this.slow(30000);

			initHomeDir('home-local');
			await loginCLISync();

			let { status, stdout } = await runAxwaySync(['service-account', 'update', 'Test', '--name', 'Test2', '--desc', 'Test 2 is cool', '--role', '--secret', '123abc']);
			expect(stdout.toString()).to.match(renderRegexFromFile('update/success'));
			expect(status).to.equal(0);

			({ stdout } = await runAxwaySync(['service-account', 'view', 'Test2']));
			expect(stdout.toString()).to.match(renderRegexFromFile('update/view-after'));
		});

		it('should output update help', async () => {
			const { status, stdout } = await runAxwaySync(['service-account', 'update', '--help']);
			expect(stdout).to.match(renderRegexFromFile('update/help'));
			expect(status).to.equal(2);
		});
	});

	describe('remove', () => {
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			const { status, stderr } = await runAxwaySync(['service-account', 'remove', 'Test']);
			expect(stderr.toString()).to.match(renderRegexFromFile('remove/not-authenticated'));
			expect(status).to.equal(1);
		});

		it('should error if org not found', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'remove', 'Test', '--org', 'does_not_exist']);
			expect(stderr.toString()).to.match(renderRegexFromFile('remove/bad-org'));
			expect(status).to.equal(1);
		});

		it('should error if service account is not found', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync(['service-account', 'remove', 'does_not_exist']);
			expect(stderr.toString()).to.match(renderRegexFromFile('remove/not-found'));
			expect(status).to.equal(1);
		});

		it('should remove a service account by name', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			let { status, stdout } = await runAxwaySync(['service-account', 'list', '--json']);
			expect(JSON.parse(stdout).clients.length).to.equal(2);

			({ status, stdout } = await runAxwaySync(['service-account', 'remove', 'Test']));
			expect(stdout.toString()).to.match(renderRegexFromFile('remove/by-name-success'));
			expect(status).to.equal(0);

			({ stdout } = await runAxwaySync(['service-account', 'list', '--json']));
			expect(JSON.parse(stdout).clients.length).to.equal(1);
		});

		it('should remove a service account by client id', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			let { status, stdout } = await runAxwaySync(['service-account', 'list', '--json']);
			expect(JSON.parse(stdout).clients.length).to.equal(2);

			({ status, stdout } = await runAxwaySync(['service-account', 'remove', 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad']));
			expect(stdout.toString()).to.match(renderRegexFromFile('remove/by-id-success'));
			expect(status).to.equal(0);

			({ stdout } = await runAxwaySync(['service-account', 'list', '--json']));
			expect(JSON.parse(stdout).clients.length).to.equal(1);
		});

		it('should remove a service account by client id as JSON', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			let { status, stdout } = await runAxwaySync(['service-account', 'list', '--json']);
			expect(JSON.parse(stdout).clients.length).to.equal(2);

			({ status, stdout } = await runAxwaySync(['service-account', 'remove', 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad', '--json']));
			const result = JSON.parse(stdout.toString())
			expect(result.client.name).to.equal('Test');
			expect(result.client.client_id).to.equal('test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad');
			expect(status).to.equal(0);

			({ stdout } = await runAxwaySync(['service-account', 'list', '--json']));
			expect(JSON.parse(stdout).clients.length).to.equal(1);
		});

		it('should output remove help', async () => {
			const { status, stdout } = await runAxwaySync(['service-account', 'remove', '--help']);
			expect(stdout).to.match(renderRegexFromFile('remove/help'));
			expect(status).to.equal(2);
		});
	});
});
