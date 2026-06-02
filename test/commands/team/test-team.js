import {
	initHomeDir,
	loginCLI,
	renderRegexFromFile,
	resetHomeDir,
	runCommand
} from '../../helpers/index.js';

describe('axway team', () => {
	describe('help', () => {
		after(resetHomeDir);

		it('should output the help screen with color', async () => {
			const { status, stdout } = await runCommand([ 'team' ], { color: true });
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color', {}, { color: true }));
			expect(status).to.equal(0);
		});

		it('should output the help screen using --help flag', async () => {
			const { status, stdout } = await runCommand([ 'team', '--help' ], { color: true });
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color', {}, { color: true }));
			expect(status).to.equal(0);
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
			afterEach(resetHomeDir);

			it('should error if not logged in', async function () {
				initHomeDir('home-local');

				const { status, stderr } = await runCommand([ 'team', 'user', 'add', 'foo', 'bar' ]);
				expect(stderr).to.match(renderRegexFromFile('user/add/not_authenticated-stderr'));
				expect(status).to.equal(2);
			});

			it('should add a user to a team by email address', async function () {
				initHomeDir('home-local');
				await loginCLI();

				let { status, stdout } = await runCommand([ 'team', 'user', 'add', 'a team', 'test2@domain.com', '--role', 'developer' ]);
				expect(stdout).to.match(renderRegexFromFile('user/add/success'));
				expect(status).to.equal(0);

				({ status, stdout } = await runCommand([ 'team', 'user', 'list', 'a team' ]));
				expect(stdout).to.match(renderRegexFromFile('user/add/user-list'));
				expect(status).to.equal(0);
			});

			it('should output list help', async () => {
				const { status, stdout } = await runCommand([ 'team', 'user', 'add', '--help' ]);
				expect(stdout).to.match(renderRegexFromFile('user/add/help'));
				expect(status).to.equal(0);
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
