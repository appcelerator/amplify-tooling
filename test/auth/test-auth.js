import fs from 'fs-extra';
import got from 'got';
import path from 'path';
import {
	initHomeDir,
	renderRegexFromFile,
	resetHomeDir,
	runAxway,
	runAxwaySync,
	startServers,
	stopServers
} from '../helpers';
import { isHeadless } from '@axway/amplify-cli-utils';

const itSkipHeadless = isHeadless() ? it.skip : it;

describe('axway auth', () => {
	describe('help', () => {
		after(resetHomeDir);

		it('should output the help screen with color', async () => {
			const { status, stdout } = await runAxwaySync([ 'auth' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('help/help-with-color'));
		});

		it('should output the help screen using --help flag', async () => {
			const { status, stdout } = await runAxwaySync([ 'auth', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('help/help-with-color'));
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
		afterEach(stopServers);
		afterEach(resetHomeDir);

		// Windows is never headless, so we can't force headless to test it
		(process.platform === 'win32' ? it.skip : it)('should error if env is headless', async function () {
			initHomeDir('home-local');

			let { status, stderr } = await runAxwaySync([ 'auth', 'login' ], {
				env: {
					SSH_TTY: '1'
				}
			});
			expect(status).to.equal(1);
			expect(stderr).to.match(renderRegexFromFile('login/headless'));
		});

		itSkipHeadless('should log into platform account using PKCE, list account, and login again', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			let { status, stdout } = await runAxwaySync([ 'auth', 'login' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('login/success'));

			({ status, stdout } = await runAxwaySync([ 'auth', 'list' ]));
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('list/foo-bar-platform-account'));

			({ status, stdout } = await runAxwaySync([ 'auth', 'login' ]));
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('login/already-authenticated'));
		});

		itSkipHeadless('should log into platform account using PKCE and return result as JSON', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			let { status, stdout } = await runAxwaySync([ 'auth', 'login', '--json' ]);
			expect(status).to.equal(0);
			let account = JSON.parse(stdout);
			expect(account).to.be.an('object');
			expect(account.name).to.equal('test_client:foo@bar.com');

			({ status, stdout } = await runAxwaySync([ 'auth', 'list', '--json' ]));
			expect(status).to.equal(0);
			const accounts = JSON.parse(stdout);
			expect(accounts).to.be.an('array');
			expect(accounts).to.have.lengthOf(1);
			expect(accounts[0].name).to.equal('test_client:foo@bar.com');

			({ status, stdout } = await runAxwaySync([ 'auth', 'login', '--json' ]));
			expect(status).to.equal(0);
			account = JSON.parse(stdout);
			expect(account.name).to.equal('test_client:foo@bar.com');
		});

		it('should log into platform account using PKCE without launching the browser', async function () {
			initHomeDir('home-manual');
			this.servers = await startServers();

			let stdout = '';
			let waiting = false;
			const child = await runAxway([ 'auth', 'login', '--no-launch-browser' ]);

			await new Promise(resolve => {
				child.stdout.on('data', data => {
					stdout += data.toString();

					if (!waiting) {
						waiting = true;
						// wait for the auth to initialize
						setTimeout(resolve, 2000);
					}
				});
			});

			expect(stdout).to.match(renderRegexFromFile('login/manual-open-browser'));

			const m = stdout.match(/Please open following link in your browser:\s+.*?(http[^\s]+)/);
			if (!m) {
				throw new Error('No URL!');
			}

			const response = await got(m[1]);
			const url = new URL(response.url);
			if (url.hash) {
				const redirect = new URL(url.hash.substring(1), url.origin).searchParams.get('redirect');
				if (redirect) {
					await got(redirect);
				}
			}
		});

		itSkipHeadless('should log into platform account using client secret', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			let { status, stdout } = await runAxwaySync([ 'auth', 'login', '--client-secret', 'shhhh' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('login/success'));

			({ status, stdout } = await runAxwaySync([ 'auth', 'list' ]));
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('list/foo-bar-platform-account'));
		});

		it('should log into service account using client secret', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			let { status, stdout } = await runAxwaySync([ 'auth', 'login', '--client-secret', 'shhhh', '--service' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('login/success-service'));

			({ status, stdout } = await runAxwaySync([ 'auth', 'list' ]));
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('list/service-bar-account'));
		});

		it('should error if secret file is invalid', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			let { status, stdout, stderr } = await runAxwaySync([ 'auth', 'login', '--secret-file', 'does_not_exist' ]);
			expect(status).to.equal(1);
			expect(stderr).to.match(renderRegexFromFile('login/secret-file-not-found'));

			({ status, stdout, stderr } = await runAxwaySync([ 'auth', 'login', '--secret-file', path.join(__dirname, 'login/bad-secret.pem') ]));
			expect(status).to.equal(1);
			expect(stderr).to.match(renderRegexFromFile('login/invalid-secret-file'));
		});

		it('should log into service account using signed JWT', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			let { status, stdout } = await runAxwaySync([ 'auth', 'login', '--secret-file', path.join(__dirname, 'login/secret.pem') ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('login/success-service'));

			({ status, stdout } = await runAxwaySync([ 'auth', 'list' ]));
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('list/service-bar-account'));
		});

		it('should log into platform account using username and password', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			let { status, stdout } = await runAxwaySync([ 'auth', 'login', '--username', 'foo', '--password', 'bar' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('login/success-headless'));

			({ status, stdout } = await runAxwaySync([ 'auth', 'list' ]));
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('list/foo-bar-platform-account'));
		});

		itSkipHeadless('should log into both a platform and service account', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			let { status, stdout } = await runAxwaySync([ 'auth', 'login' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('login/success'));

			({ status, stdout } = await runAxwaySync([ 'auth', 'list' ]));
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('list/foo-bar-platform-account'));

			({ status, stdout } = await runAxwaySync([ 'auth', 'login', '--secret-file', path.join(__dirname, 'login/secret.pem') ]));
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('login/success-service-not-default'));

			({ status, stdout } = await runAxwaySync([ 'auth', 'list' ]));
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('list/platform-service-accounts'));
		});

		itSkipHeadless('should error if browser times out', async function () {
			initHomeDir('home-timeout');
			this.servers = await startServers();

			const { status, stdout, stderr } = await runAxwaySync([ 'auth', 'login' ], {
				passiveOpen: true
			});

			expect(status).to.equal(1);
			expect(stdout).to.match(renderRegexFromFile('login/timeout-stdout'));
			expect(stderr).to.match(renderRegexFromFile('login/timeout-stderr'));
		});

		it('should display login help', async () => {
			const { status, stdout } = await runAxwaySync([ 'auth', 'login', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('login/help'));
		});
	});

	describe('logout', () => {
		afterEach(stopServers);
		afterEach(resetHomeDir);

		itSkipHeadless('should logout of platform account', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			let { status, stdout } = await runAxwaySync([ 'auth', 'login' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('login/success'));

			({ status, stdout } = await runAxwaySync([ 'auth', 'list', '--json' ]));
			let accounts = JSON.parse(stdout);
			expect(accounts).to.be.an('array');
			expect(accounts).to.have.lengthOf(1);
			expect(accounts[0].name).to.equal('test_client:foo@bar.com');

			({ status, stdout } = await runAxwaySync([ 'auth', 'logout' ]));
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('logout/success'));

			({ status, stdout } = await runAxwaySync([ 'auth', 'list', '--json' ]));
			accounts = JSON.parse(stdout);
			expect(accounts).to.be.an('array');
			expect(accounts).to.have.lengthOf(0);
		});

		itSkipHeadless('should logout of platform account and return result as JSON', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			let { status, stdout } = await runAxwaySync([ 'auth', 'login' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('login/success'));

			({ status, stdout } = await runAxwaySync([ 'auth', 'list', '--json' ]));
			let accounts = JSON.parse(stdout);
			expect(accounts).to.be.an('array');
			expect(accounts).to.have.lengthOf(1);
			expect(accounts[0].name).to.equal('test_client:foo@bar.com');

			({ status, stdout } = await runAxwaySync([ 'auth', 'logout', '--json' ]));
			expect(status).to.equal(0);
			const revoked = JSON.parse(stdout);
			expect(revoked).to.be.an('array');
			expect(revoked).to.have.lengthOf(1);
			expect(revoked[0].name).to.equal('test_client:foo@bar.com');

			({ status, stdout } = await runAxwaySync([ 'auth', 'list', '--json' ]));
			accounts = JSON.parse(stdout);
			expect(accounts).to.be.an('array');
			expect(accounts).to.have.lengthOf(0);
		});

		it.skip('should logout of service account', async function () {
			//
		});

		it('should error if no authenticated accounts', async () => {
			const { status, stderr } = await runAxwaySync([ 'auth', 'logout' ]);
			expect(status).to.equal(1);
			expect(stderr).to.match(renderRegexFromFile('logout/no-accounts'));
		});

		it('should error if specified account is not found', async () => {
			const { status, stderr } = await runAxwaySync([ 'auth', 'logout', 'foo' ]);
			expect(status).to.equal(1);
			expect(stderr).to.match(renderRegexFromFile('logout/not-found'));
		});

		it('should display logout help', async () => {
			const { status, stdout } = await runAxwaySync([ 'auth', 'logout', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('logout/help'));
		});
	});

	describe('switch', () => {
		afterEach(stopServers);
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
		afterEach(stopServers);
		afterEach(resetHomeDir);

		itSkipHeadless('should log into platform account and display whoami for all accounts', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			let { status, stdout } = await runAxwaySync([ 'auth', 'login' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('login/success'));

			({ status, stdout } = await runAxwaySync([ 'auth', 'whoami' ]));
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('whoami/foo-bar-account'));
		});

		it.skip('should log into service account and display whoami for all accounts', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			// TODO
		});

		itSkipHeadless('should login and display whoami for specific account', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			let { status, stdout } = await runAxwaySync([ 'auth', 'login' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('login/success'));

			({ status, stdout } = await runAxwaySync([ 'auth', 'whoami', 'foo@bar.com' ]));
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('whoami/foo-bar-account'));
		});

		itSkipHeadless('should login and display whoami and output result as JSON', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			let { status, stdout } = await runAxwaySync([ 'auth', 'login' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('login/success'));

			({ status, stdout } = await runAxwaySync([ 'auth', 'whoami', '--json' ]));
			expect(status).to.equal(0);
			const accounts = JSON.parse(stdout);
			expect(accounts).to.be.an('array');
			expect(accounts).to.have.lengthOf(1);
			expect(accounts[0].name).to.equal('test_client:foo@bar.com');
		});

		it('should login and display not logged in', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			const { status, stdout } = await runAxwaySync([ 'auth', 'whoami' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('whoami/not-logged-in'));
		});

		it('should login and display not logged into a specific account', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			const { status, stdout } = await runAxwaySync([ 'auth', 'whoami', 'foo@bar.com' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('whoami/not-logged-in-account'));
		});

		it('should display whoami help', async () => {
			const { status, stdout } = await runAxwaySync([ 'auth', 'whoami', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('whoami/help'));
		});
	});

	describe('server-info', () => {
		afterEach(stopServers);
		afterEach(resetHomeDir);

		it('should get server info', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			const { status, stdout } = await runAxwaySync([ 'auth', 'server-info' ]);
			expect(status).to.equal(0);
			const info = JSON.parse(stdout);
			expect(info).to.deep.equal(fs.readJsonSync(path.resolve(__dirname, '../helpers/server-info.json')));
		});
	});
});
