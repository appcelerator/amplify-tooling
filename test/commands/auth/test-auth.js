// import got from 'got';
import path from 'path';
import {
	initHomeDir,
	renderRegexFromFile,
	resetHomeDir,
	runAxwaySync
} from '../../helpers/index.js';
import { readJsonSync } from '../../../dist/lib/fs.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('axway auth', () => {
	describe('help', () => {
		after(resetHomeDir);

		it('should output the help screen with color', async () => {
			const { status, stdout } = await runAxwaySync([ 'auth' ]);
			expect(stdout).to.match(renderRegexFromFile('help/help-with-color'));
			expect(status).to.equal(2);
		});

		it('should output the help screen using --help flag', async () => {
			const { status, stdout } = await runAxwaySync([ 'auth', '--help' ]);
			expect(stdout).to.match(renderRegexFromFile('help/help-with-color'));
			expect(status).to.equal(2);
		});
	});

	describe('list', () => {
		afterEach(resetHomeDir);

		it('should list no authenticated accounts', async () => {
			const { status, stdout } = await runAxwaySync([ 'auth', 'list' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('list/no-accounts'));
		});

		it('should list no authenticated accounts as JSON', async () => {
			const { status, stdout } = await runAxwaySync([ 'auth', 'list', '--json' ]);
			expect(status).to.equal(0);
			expect(JSON.parse(stdout)).to.deep.equal([]);
		});

		it('should display list help', async () => {
			const { status, stdout } = await runAxwaySync([ 'auth', 'list', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('list/help'));
		});

		// NOTE: `list` tests with accounts are handled by `login` tests
	});

	describe('login', () => {
		afterEach(resetHomeDir);

		it('should log into service account using client secret', async function () {
			initHomeDir('home-local');

			let { status, stdout } = await runAxwaySync([ 'auth', 'login', '--client-id', 'test-auth-client-secret', '--client-secret', 'shhhh' ]);
			expect(stdout).to.match(renderRegexFromFile('login/client-secret-success'));
			expect(status).to.equal(0);

			({ status, stdout } = await runAxwaySync([ 'auth', 'list' ]));
			expect(stdout).to.match(renderRegexFromFile('list/test-auth-client-secret-account'));
			expect(status).to.equal(0);
		});

		it('should error if secret file is invalid', async function () {
			initHomeDir('home-local');

			let { status, stdout, stderr } = await runAxwaySync([ 'auth', 'login', '--client-id', 'test-auth-client-secret', '--secret-file', 'does_not_exist' ]);
			expect(stderr).to.match(renderRegexFromFile('login/secret-file-not-found'));
			expect(status).to.equal(1);

			({ status, stdout, stderr } = await runAxwaySync([ 'auth', 'login', '--client-id', 'test-auth-client-secret', '--secret-file', path.join(__dirname, 'login/bad-secret.pem') ]));
			expect(stderr).to.match(renderRegexFromFile('login/invalid-secret-file'));
			expect(status).to.equal(1);
		});

		it('should log into service account using signed JWT', async function () {
			initHomeDir('home-local');

			let { status, stdout } = await runAxwaySync([ 'auth', 'login', '--client-id', 'test-auth-client-cert', '--secret-file', path.join(__dirname, '../../helpers/private_key.pem') ]);
			expect(stdout).to.match(renderRegexFromFile('login/client-cert-success'));
			expect(status).to.equal(0);

			({ status, stdout } = await runAxwaySync([ 'auth', 'list' ]));
			expect(stdout).to.match(renderRegexFromFile('list/test-auth-client-cert-account'));
			expect(status).to.equal(0);
		});

		it.skip('should require client id and auth for json output', async function () {
			//
		});

		it('should display login help', async () => {
			const { status, stdout } = await runAxwaySync([ 'auth', 'login', '--help' ]);
			expect(stdout).to.match(renderRegexFromFile('login/help'));
			expect(status).to.equal(2);
		});
	});

	describe('logout', () => {
		afterEach(resetHomeDir);

		it('should logout of service account', async function () {
			initHomeDir('home-local');

			let { status, stdout } = await runAxwaySync([ 'auth', 'login', '--client-id', 'test-auth-client-secret', '--client-secret', 'shhhh' ]);
			expect(stdout).to.match(renderRegexFromFile('login/client-secret-success'));
			expect(status).to.equal(0);

			({ status, stdout } = await runAxwaySync([ 'auth', 'list', '--json' ]));
			let accounts = JSON.parse(stdout);
			expect(accounts).to.be.an('array');
			expect(accounts).to.have.lengthOf(1);
			expect(accounts[0].name).to.equal('test-auth-client-secret');

			({ status, stdout } = await runAxwaySync([ 'auth', 'logout' ]));
			expect(stdout).to.match(renderRegexFromFile('logout/success'));
			expect(status).to.equal(0);

			({ status, stdout } = await runAxwaySync([ 'auth', 'list', '--json' ]));
			accounts = JSON.parse(stdout);
			expect(accounts).to.be.an('array');
			expect(accounts).to.have.lengthOf(0);
		});

		it('should logout of service account and return result as JSON', async function () {
			initHomeDir('home-local');

			let { status, stdout } = await runAxwaySync([ 'auth', 'login', '--client-id', 'test-auth-client-secret', '--client-secret', 'shhhh' ]);
			expect(stdout).to.match(renderRegexFromFile('login/client-secret-success'));
			expect(status).to.equal(0);

			({ status, stdout } = await runAxwaySync([ 'auth', 'list', '--json' ]));
			let accounts = JSON.parse(stdout);
			expect(accounts).to.be.an('array');
			expect(accounts).to.have.lengthOf(1);
			expect(accounts[0].name).to.equal('test-auth-client-secret');

			({ status, stdout } = await runAxwaySync([ 'auth', 'logout', '--json' ]));
			expect(status).to.equal(0);
			const revoked = JSON.parse(stdout);
			expect(revoked).to.be.an('array');
			expect(revoked).to.have.lengthOf(1);
			expect(revoked[0].name).to.equal('test-auth-client-secret');

			({ status, stdout } = await runAxwaySync([ 'auth', 'list', '--json' ]));
			accounts = JSON.parse(stdout);
			expect(accounts).to.be.an('array');
			expect(accounts).to.have.lengthOf(0);
		});

		it('should error if no authenticated accounts', async () => {
			const { status, stderr } = await runAxwaySync([ 'auth', 'logout' ]);
			expect(stderr).to.match(renderRegexFromFile('logout/no-accounts'));
			expect(status).to.equal(1);
		});

		it('should error if specified account is not found', async () => {
			const { status, stderr } = await runAxwaySync([ 'auth', 'logout', 'foo' ]);
			expect(stderr).to.match(renderRegexFromFile('logout/not-found'));
			expect(status).to.equal(1);
		});

		it('should display logout help', async () => {
			const { status, stdout } = await runAxwaySync([ 'auth', 'logout', '--help' ]);
			expect(stdout).to.match(renderRegexFromFile('logout/help'));
			expect(status).to.equal(2);
		});
	});

	describe('switch', () => {
		afterEach(resetHomeDir);

		it.skip('should login and switch org', async function () {
			//
		});

		it('should display switch help', async () => {
			const { status, stdout } = await runAxwaySync([ 'auth', 'switch', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('switch/help'));
		});
	});

	describe('whoami', () => {
		afterEach(resetHomeDir);

		it.skip('should log into service account and display whoami for all accounts', async function () {
			initHomeDir('home-local');

			// TODO
		});

		it('should login and display not logged into a specific account', async function () {
			initHomeDir('home-local');

			const { status, stdout } = await runAxwaySync([ 'auth', 'whoami', 'foo@bar.com' ]);
			expect(stdout).to.match(renderRegexFromFile('whoami/not-logged-in-account'));
			expect(status).to.equal(0);
		});

		it('should display whoami help', async () => {
			const { status, stdout } = await runAxwaySync([ 'auth', 'whoami', '--help' ]);
			expect(stdout).to.match(renderRegexFromFile('whoami/help'));
			expect(status).to.equal(2);
		});
	});

	describe('server-info', () => {
		afterEach(resetHomeDir);

		it('should get server info', async function () {
			initHomeDir('home-local');

			const { status, stdout } = await runAxwaySync([ 'auth', 'server-info' ]);
			const info = JSON.parse(stdout);
			expect(info).to.deep.equal(readJsonSync(path.resolve(__dirname, '../../helpers/server-info.json')));
			expect(status).to.equal(0);
		});
	});
});
