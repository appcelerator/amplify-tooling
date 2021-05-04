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

		it('should login using PKCE, list account, and login again', async function () {
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

			({ status, stdout } = await runAxway([ 'auth', 'login' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('login/login-already-authenticated'));
		});

		it('should exit if already logged in', async () => {
			//
		});

		it('should login using PKCE and return result as JSON', async () => {
			//
		});

		it('should login using PKCE without launching the browser', async () => {
			//
		});

		it('should login using client secret', async () => {
			//
		});

		it('should login to service account using client secret', async () => {
			//
		});

		it('should login using signed JWT', async () => {
			//
		});

		it('should login using username and password', async () => {
			//
		});

		it('should error if browser times out', async function () {
			this.timeout(150000); // 2.5 minutes

			//
		});

		it('should display login help', async () => {
			const { status, stdout } = runAxwaySync([ 'auth', 'login', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('login/login-help'));
		});
	});

	describe('logout', () => {
		afterEach(resetHomeDir);

		it('should error if no authenticated accounts', async () => {
			const { status, stderr } = runAxwaySync([ 'auth', 'logout' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('logout/logout-no-accounts'));
		});

		it('should display logout help', async () => {
			const { status, stdout } = runAxwaySync([ 'auth', 'logout', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('logout/logout-help'));
		});
	});

	describe('switch', () => {
		afterEach(resetHomeDir);

		//

		it('should display switch help', async () => {
			const { status, stdout } = runAxwaySync([ 'auth', 'switch', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('switch/switch-help'));
		});
	});

	describe('whoami', () => {
		afterEach(resetHomeDir);

		//

		it('should display whoami help', async () => {
			const { status, stdout } = runAxwaySync([ 'auth', 'whoami', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('whoami/whoami-help'));
		});
	});
});
