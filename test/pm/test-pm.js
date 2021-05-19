import {
	renderRegexFromFile,
	resetHomeDir,
	runAxwaySync
} from '../helpers';

describe('axway pm', () => {
	describe('help', () => {
		after(resetHomeDir);

		it('should output the help screen with color', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('help/with-color'));
		});

		it('should output the help screen using --help flag', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('help/with-color'));
		});
	});

	describe('list', () => {
		after(resetHomeDir);

		it('should output no installed packages', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'list' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('list/no-packages'));
		});

		it('should output no installed packages as JSON', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'list', '--json' ]);
			expect(status).to.equal(0);
			const results = JSON.parse(stdout);
			expect(results).to.be.an('array');
			expect(results).to.have.lengthOf(0);
		});

		it('should output list help', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'list', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('list/help'));
		});
	});

	describe('search', () => {
		it('should show all packages', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'search', '--json' ]);
			expect(status).to.equal(0);
			const results = JSON.parse(stdout);
			expect(results).to.be.an('array');

			expect(results.some(p => p.name === '@axway/axway-central-cli')).to.be.true;
			expect(results.some(p => p.name === 'acs')).to.be.true;
		});

		it('should find specific package', async () => {
			let { status, stdout } = await runAxwaySync([ 'pm', 'search', 'acs' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('search/acs'));

			({ status, stdout } = await runAxwaySync([ 'pm', 'search', 'acs', '--json' ]));
			expect(status).to.equal(0);
			const result = JSON.parse(stdout);
			expect(result).to.be.an('array');
			expect(result).to.have.lengthOf(1);
			expect(result[0].name).to.equal('acs');
		});

		it('should find no results', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'search', 'abcdef' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('search/no-results'));
		});

		it('should output search help', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'search', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('search/help'));
		});
	});

	describe('install', () => {
		afterEach(resetHomeDir);

		it('should install the acs extension', async function () {
			this.timeout(60000);
			this.slow(30000);

			let { status, stdout } = await runAxwaySync([ 'pm', 'install', 'acs' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('install/acs-installed'));

			({ status, stdout } = await runAxwaySync([ 'pm', 'list', '--json' ]));
			expect(status).to.equal(0);
			const results = JSON.parse(stdout);
			expect(results).to.have.lengthOf(1);
			expect(results[0].name).to.equal('acs');

			({ status, stdout } = await runAxwaySync([ 'pm', 'view', 'acs' ]));
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('view/acs-installed'));
		});

		it('should install a specific acs extension version', async function () {
			this.timeout(60000);
			this.slow(30000);

			let { status, stdout } = await runAxwaySync([ 'pm', 'install', 'acs@2.1.9' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('install/acs-installed'));

			({ status, stdout } = await runAxwaySync([ 'pm', 'list', '--json' ]));
			expect(status).to.equal(0);
			const results = JSON.parse(stdout);
			expect(results).to.have.lengthOf(1);
			expect(results[0].name).to.equal('acs');
			expect(results[0].version).to.equal('2.1.9');
		});

		it('should output install help', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'install', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('install/help'));
		});
	});

	describe('uninstall', () => {
		afterEach(resetHomeDir);

		it('should uninstall the acs extension', async function () {
			this.timeout(60000);
			this.slow(30000);

			let { status, stdout } = await runAxwaySync([ 'pm', 'install', 'acs' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('install/acs-installed'));

			({ status, stdout } = await runAxwaySync([ 'pm', 'list', '--json' ]));
			expect(status).to.equal(0);
			let results = JSON.parse(stdout);
			expect(results).to.have.lengthOf(1);
			expect(results[0].name).to.equal('acs');

			({ status, stdout } = await runAxwaySync([ 'pm', 'uninstall', 'acs' ]));
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('uninstall/acs-uninstalled', {
				packagePath: results[0].versions[results[0].version].path
			}));

			({ status, stdout } = await runAxwaySync([ 'pm', 'list', '--json' ]));
			expect(status).to.equal(0);
			results = JSON.parse(stdout);
			expect(results).to.have.lengthOf(0);
		});

		it('should error uninstalling a package that is not installed', async () => {
			let { status, stderr } = await runAxwaySync([ 'pm', 'uninstall', 'acs' ]);
			expect(status).to.equal(1);
			expect(stderr).to.match(renderRegexFromFile('uninstall/not-installed'));
		});

		it('should output uninstall help', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'uninstall', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('uninstall/help'));
		});
	});

	describe('update', () => {
		afterEach(resetHomeDir);
	});

	describe('purge', () => {
		afterEach(resetHomeDir);
	});

	describe('view', () => {
		after(resetHomeDir);

		it('should display current info for a package that is not installed', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'view', 'acs' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('view/acs-not-installed'));
		});

		it('should display current info for a package as JSON', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'view', 'acs', '--json' ]);
			expect(status).to.equal(0);
			const info = JSON.parse(stdout);
			expect(info.name).to.equal('acs');
		});

		it('should display info for a specific package version', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'view', 'acs@2.1.9' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('view/acs-not-installed'));
		});

		it('should error if package is not found', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'view', 'abcdef' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('view/not-found'));
		});

		it('should error if package is not found as JSON', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'view', 'abcdef', '--json' ]);
			expect(status).to.equal(0);
			const info = JSON.parse(stdout);
			expect(info).to.equal(null);
		});

		it('should output view help', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'view', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('view/help'));
		});
	});
});
