import {
	initHomeDir,
	renderRegexFromFile,
	resetHomeDir,
	runAxway,
	runAxwaySync,
	startServers,
	stopServers
} from '../helpers';

describe('axway auth', () => {
	describe('help', () => {
		after(resetHomeDir);

		it('should output the help screen with color', async () => {
			const { status, stdout } = runAxwaySync([ 'auth' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
		});

		it('should output the help screen using --help flag', async () => {
			const { status, stdout } = runAxwaySync([ 'auth', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
		});
	});

	describe('list', () => {
		afterEach(resetHomeDir);

		it('should list no authenticated accounts', async () => {
			const { status, stdout } = runAxwaySync([ 'auth', 'list' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('list/list-no-accounts'));
		});

		it('should list no authenticated accounts as JSON', async () => {
			const { status, stdout } = runAxwaySync([ 'auth', 'list', '--json' ]);
			expect(status).to.equal(0);
			expect(JSON.parse(stdout.toString())).to.deep.equal([]);
		});

		it('should display list help', async () => {
			const { status, stdout } = runAxwaySync([ 'auth', 'list', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('list/list-help'));
		});

		// NOTE: `list` tests with accounts are handled by `login` tests
	});

	describe('login', () => {
		afterEach(resetHomeDir);
		afterEach(stopServers);

		it('should log into platform account using PKCE, list account, and login again', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			let { status, stdout } = await runAxway([ 'auth', 'login' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('login/login-success'));

			({ status, stdout } = runAxwaySync([ 'auth', 'list', '--json' ]));
			expect(status).to.equal(0);
			const accounts = JSON.parse(stdout.toString());
			expect(accounts).to.be.an('array');
			expect(accounts).to.have.lengthOf(1);
			expect(accounts[0].name).to.equal('test_client:foo@bar.com');

			({ status, stdout } = await runAxway([ 'auth', 'login' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('login/login-already-authenticated'));
		});

		it('should log into platform account using PKCE and return result as JSON', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			let { status, stdout } = await runAxway([ 'auth', 'login', '--json' ]);
			expect(status).to.equal(0);
			let account = JSON.parse(stdout.toString());
			expect(account).to.be.an('object');
			expect(account.name).to.equal('test_client:foo@bar.com');

			({ status, stdout } = runAxwaySync([ 'auth', 'list', '--json' ]));
			expect(status).to.equal(0);
			const accounts = JSON.parse(stdout.toString());
			expect(accounts).to.be.an('array');
			expect(accounts).to.have.lengthOf(1);
			expect(accounts[0].name).to.equal('test_client:foo@bar.com');

			({ status, stdout } = await runAxway([ 'auth', 'login', '--json' ]));
			expect(status).to.equal(0);
			account = JSON.parse(stdout.toString());
			expect(account.name).to.equal('test_client:foo@bar.com');
		});

		it('should log into platform account using PKCE without launching the browser', async function () {
			//
		});

		// it('should log into platform account using client secret', async function () {
		// 	//
		// });

		// it('should log into service account using client secret', async function () {
		// 	//
		// });

		// it('should log into service using signed JWT', async function () {
		// 	//
		// });

		// it('should log into service using username and password', async function () {
		// 	//
		// });

		it('should error if browser times out', async function () {
			initHomeDir('home-timeout');
			this.servers = await startServers();

			const { status, stdout, stderr } = await runAxway([ 'auth', 'login' ], {
				passiveOpen: true
			});
			expect(status).to.equal(1);
			expect(stdout.toString()).to.match(renderRegexFromFile('login/login-timeout-stdout'));
			expect(stderr.toString()).to.match(renderRegexFromFile('login/login-timeout-stderr'));
		});

		it('should display login help', async () => {
			const { status, stdout } = runAxwaySync([ 'auth', 'login', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('login/login-help'));
		});
	});

	describe('logout', () => {
		afterEach(resetHomeDir);
		afterEach(stopServers);

		it('should logout of platform account', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			let { status, stdout } = await runAxway([ 'auth', 'login' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('login/login-success'));

			({ status, stdout } = runAxwaySync([ 'auth', 'list', '--json' ]));
			let accounts = JSON.parse(stdout.toString());
			expect(accounts).to.be.an('array');
			expect(accounts).to.have.lengthOf(1);
			expect(accounts[0].name).to.equal('test_client:foo@bar.com');

			({ status, stdout } = await runAxway([ 'auth', 'logout' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('logout/logout-success'));

			({ status, stdout } = runAxwaySync([ 'auth', 'list', '--json' ]));
			accounts = JSON.parse(stdout.toString());
			expect(accounts).to.be.an('array');
			expect(accounts).to.have.lengthOf(0);
		});

		it('should logout of platform account and return result as JSON', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();

			let { status, stdout } = await runAxway([ 'auth', 'login' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('login/login-success'));

			({ status, stdout } = runAxwaySync([ 'auth', 'list', '--json' ]));
			let accounts = JSON.parse(stdout.toString());
			expect(accounts).to.be.an('array');
			expect(accounts).to.have.lengthOf(1);
			expect(accounts[0].name).to.equal('test_client:foo@bar.com');

			({ status, stdout } = await runAxway([ 'auth', 'logout', '--json' ]));
			expect(status).to.equal(0);
			const revoked = JSON.parse(stdout.toString());
			expect(revoked).to.be.an('array');
			expect(revoked).to.have.lengthOf(1);
			expect(revoked[0].name).to.equal('test_client:foo@bar.com');

			({ status, stdout } = runAxwaySync([ 'auth', 'list', '--json' ]));
			accounts = JSON.parse(stdout.toString());
			expect(accounts).to.be.an('array');
			expect(accounts).to.have.lengthOf(0);
		});

		it('should logout of service account', async function () {
			//
		});

		it('should error if no authenticated accounts', async () => {
			const { status, stderr } = runAxwaySync([ 'auth', 'logout' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('logout/logout-no-accounts'));
		});

		it('should error if specified account is not found', async () => {
			const { status, stderr } = runAxwaySync([ 'auth', 'logout', 'foo' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('logout/logout-not-found'));
		});

		it('should display logout help', async () => {
			const { status, stdout } = runAxwaySync([ 'auth', 'logout', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('logout/logout-help'));
		});
	});

	describe('switch', () => {
		afterEach(resetHomeDir);
		afterEach(stopServers);

		//

		it('should display switch help', async () => {
			const { status, stdout } = runAxwaySync([ 'auth', 'switch', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('switch/switch-help'));
		});
	});

	describe('whoami', () => {
		afterEach(resetHomeDir);
		afterEach(stopServers);

		//

		it('should display whoami help', async () => {
			const { status, stdout } = runAxwaySync([ 'auth', 'whoami', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('whoami/whoami-help'));
		});
	});
});
