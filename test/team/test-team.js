import {
	initHomeDir,
	loginCLISync,
	renderRegexFromFile,
	resetHomeDir,
	runAxwaySync,
	startServers,
	stopServers
} from '../helpers/index.js';

describe('axway team', () => {
	describe('help', () => {
		after(resetHomeDir);

		it('should output the help screen with color', async () => {
			const { status, stdout } = await runAxwaySync([ 'team' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
		});

		it('should output the help screen using --help flag', async () => {
			const { status, stdout } = await runAxwaySync([ 'team', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
		});
	});

	describe('add', () => {
		//
	});

	describe('list', () => {
		//
	});

	describe('remove', () => {
		//
	});

	describe('update', () => {
		//
	});

	describe('user', () => {
		describe('help', () => {
			//
		});

		describe('add', () => {
			afterEach(stopServers);
			afterEach(resetHomeDir);

			it('should error if not logged in', async function() {
				initHomeDir('home-local');

				const { status, stderr } = await runAxwaySync([ 'team', 'user', 'add', 'foo', 'bar', 'baz', '--role', 'developer' ]);
				expect(status).to.equal(1);
				expect(stderr).to.match(renderRegexFromFile('user/add/not_authenticated'));
			});

			it('should add a user to a team by email address', async function () {
				initHomeDir('home-local');
				this.servers = await startServers();
				await loginCLISync();

				let { status, stdout } = await runAxwaySync([ 'team', 'user', 'add', 'foo org', 'a team', 'test2@domain.com', '--role', 'developer' ]);
				expect(status).to.equal(0);
				expect(stdout).to.match(renderRegexFromFile('user/add/success'));

				({ status, stdout } = await runAxwaySync([ 'team', 'user', 'list', 'foo org', 'a team' ]));
				expect(status).to.equal(0);
				expect(stdout).to.match(renderRegexFromFile('user/add/user-list'));
			});

			it('should output list help', async () => {
				const { status, stdout } = await runAxwaySync([ 'team', 'user', 'add', '--help' ]);
				expect(status).to.equal(2);
				expect(stdout).to.match(renderRegexFromFile('user/add/help'));
			});
		});

		describe('list', () => {
			//
		});

		describe('remove', () => {
			//
		});

		describe('roles', () => {
			//
		});

		describe('update', () => {
			//
		});
	});

	describe('view', () => {
		//
	});
});
