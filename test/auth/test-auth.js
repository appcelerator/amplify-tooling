import {
	renderRegexFromFile,
	resetHomeDir,
	runAxwaySync
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

	describe('login', () => {
		afterEach(resetHomeDir);

		//

		it('should display login help', async () => {
			const { status, stdout } = runAxwaySync([ 'auth', 'login', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('login/login-help'));
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
