import {
	renderRegexFromFile,
	resetHomeDir,
	runAxwaySync
} from '../helpers/index.js';

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
		it('should show all packages', async function () {
			this.timeout(120000);
			this.slow(60000);

			const { status, stdout } = await runAxwaySync([ 'pm', 'search', '--json' ]);
			expect(status).to.equal(0);
			const results = JSON.parse(stdout);
			expect(results).to.be.an('array');

			expect(results.some(p => p.name === '@axway/axway-central-cli')).to.be.true;
			expect(results.some(p => p.name === 'acs')).to.be.true;
		});

		it('should find specific package', async () => {
			let { status, stdout } = await runAxwaySync([ 'pm', 'search', 'api-builder' ]);
			expect(status).to.equal(0);

			({ status, stdout } = await runAxwaySync([ 'pm', 'search', 'api-builder', '--json' ]));
			expect(status).to.equal(0);
			const result = JSON.parse(stdout);
			expect(result).to.be.an('array');
			expect(result).to.have.lengthOf(1);
			expect(result[0].name).to.equal('@axway/amplify-api-builder-cli');
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
		before(function () {
			this.origPath = process.env.PATH;
		});
		afterEach(function () {
			process.env.PATH = this.origPath;
		});
		afterEach(resetHomeDir);

		it('should install the acs extension', async function () {
			this.timeout(240000);
			this.slow(60000);

			let { status, stdout, stderr } = await runAxwaySync([ 'pm', 'install', 'acs' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('install/acs-installed'));

			({ status, stdout } = await runAxwaySync([ 'pm', 'list', '--json' ]));
			expect(status).to.equal(0);
			const results = JSON.parse(stdout);
			expect(results).to.have.lengthOf(1);
			expect(results[0].name).to.equal('acs');

			({ status, stdout, stderr } = await runAxwaySync([ 'pm', 'view', 'acs' ]));
			expect(stdout).to.match(renderRegexFromFile('view/acs-installed'));
			expect(status).to.equal(0);
		});

		it('should install a specific acs extension version', async function () {
			this.timeout(240000);
			this.slow(30000);

			let { status, stdout } = await runAxwaySync([ 'pm', 'install', 'acs@2.1.9' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('install/acs-219-installed'));

			({ status, stdout } = await runAxwaySync([ 'pm', 'list', '--json' ]));
			expect(status).to.equal(0);
			const results = JSON.parse(stdout);
			expect(results[0].name).to.equal('acs');
			expect(results).to.have.lengthOf(1);
		});

		it('should error if package not found', async function () {
			this.timeout(60000);
			this.slow(30000);

			const { status, stdout } = await runAxwaySync([ 'pm', 'install', 'abcdef' ]);
			expect(status).to.equal(1);
			expect(stdout).to.match(renderRegexFromFile('install/package-not-found'));
		});

		it('should error if npm is not found', async function () {
			this.timeout(60000);
			this.slow(30000);

			process.env.PATH = '';

			const { status, stdout } = await runAxwaySync([ 'pm', 'install', 'acs' ]);
			expect(status).to.equal(1);
			expect(stdout).to.match(renderRegexFromFile('install/npm-not-found'));
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
			this.timeout(120000);
			this.slow(60000);

			let { status, stdout } = await runAxwaySync([ 'pm', 'install', 'acs' ]);
			expect(status).to.equal(0);
			// expect(stdout).to.match(renderRegexFromFile('install/acs-installed'));

			({ status, stdout } = await runAxwaySync([ 'pm', 'list', '--json' ]));
			expect(status).to.equal(0);
			let results = JSON.parse(stdout);
			expect(results).to.have.lengthOf(1);
			expect(results[0].name).to.equal('acs');

			({ status, stdout } = await runAxwaySync([ 'pm', 'uninstall', 'acs' ]));
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('uninstall/acs-uninstalled', {
				packagePath: results[0].versions[Object.keys(results[0].versions.valueOf())[0]].path.replace(/\\/g, '\\\\')
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

	describe('use', () => {
		afterEach(resetHomeDir);

		it('should use a package', async function () {
			this.timeout(120000);
			this.slow(30000);

			await runAxwaySync([ 'pm', 'install', 'acs@2.1.9' ]);
			await runAxwaySync([ 'pm', 'install', 'acs@2.1.10' ]);

			let { status, stdout } = await runAxwaySync([ 'pm', 'use', 'acs@2.1.9' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('use/acs-219'));

			({ status, stdout } = await runAxwaySync([ 'pm', 'use', 'acs@2.1.9' ]));
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('use/acs-219-already-used'));

			({ status, stdout } = await runAxwaySync([ 'pm', 'use', 'acs@2.1.10' ]));
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('use/acs-2110'));
		});

		it('should error using a non-installed package', async function () {
			this.timeout(120000);
			this.slow(30000);

			const { status, stderr } = await runAxwaySync([ 'pm', 'use', 'abcdef' ]);
			expect(status).to.equal(1);
			expect(stderr).to.match(renderRegexFromFile('use/not-found'));
		});

		it('should error using a non-installed package version', async function () {
			this.timeout(120000);
			this.slow(30000);

			await runAxwaySync([ 'pm', 'install', 'acs@2.1.9' ]);

			const { status, stderr } = await runAxwaySync([ 'pm', 'use', 'acs@2.1.10' ]);
			expect(status).to.equal(1);
			expect(stderr).to.match(renderRegexFromFile('use/acs-2110-not-installed'));
		});

		it('should output use help', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'use', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('use/help'));
		});
	});

	describe('update', () => {
		afterEach(resetHomeDir);

		it('should handle update a package', async function () {
			this.timeout(120000);
			this.slow(60000);

			await runAxwaySync([ 'pm', 'install', 'acs@2.1.9' ]);

			let { status, stdout } = await runAxwaySync([ 'pm', 'update' ]);
			expect(status).to.equal(0);
			// expect(stdout).to.match(renderRegexFromFile('update/updated-acs'));

			({ status, stdout } = await runAxwaySync([ 'pm', 'list', '--json' ]));
			expect(status).to.equal(0);
			let results = JSON.parse(stdout);
			expect(results).to.have.lengthOf(1);
			expect(results[0].name).to.equal('acs');
			const versions = Object.keys(results[0].versions);
			expect(versions).to.have.lengthOf(2);
			expect(versions).to.include('2.1.9');
		});

		it('should handle no packages to update', async function () {
			this.timeout(120000);
			this.slow(60000);

			let { status, stdout } = await runAxwaySync([ 'pm', 'update' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('update/nothing-to-update'));

			await runAxwaySync([ 'pm', 'install', 'acs' ]);

			( { status, stdout } = await runAxwaySync([ 'pm', 'update' ]));
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('update/no-updates'));
		});

		it('should error updating a package that is not installed', async function () {
			this.timeout(120000);
			this.slow(60000);

			const { status, stderr } = await runAxwaySync([ 'pm', 'update', 'acs' ]);
			expect(status).to.equal(1);
			expect(stderr).to.match(renderRegexFromFile('update/not-installed'));
		});

		it('should output update help', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'update', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('update/help'));
		});
	});

	describe('purge', () => {
		afterEach(resetHomeDir);

		it('should purge old versions with latest in use', async function () {
			this.timeout(120000);
			this.slow(30000);

			await runAxwaySync([ 'pm', 'install', 'acs@2.1.9' ]);
			await runAxwaySync([ 'pm', 'install', 'acs@2.1.10' ]);

			let { status, stdout } = await runAxwaySync([ 'pm', 'purge' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('purge/purged-219'));

			({ status, stdout } = await runAxwaySync([ 'pm', 'list', '--json' ]));
			expect(status).to.equal(0);
			let results = JSON.parse(stdout);
			expect(results).to.have.lengthOf(1);
			expect(results[0].name).to.equal('acs');
			expect(results[0].versions).to.have.property('2.1.10');
		});

		it('should purge old versions with older version in use', async function () {
			this.timeout(120000);
			this.slow(30000);

			await runAxwaySync([ 'pm', 'install', 'acs@2.1.8' ]);
			await runAxwaySync([ 'pm', 'install', 'acs@2.1.9' ]);
			await runAxwaySync([ 'pm', 'install', 'acs@2.1.10' ]);
			await runAxwaySync([ 'pm', 'use', 'acs@2.1.9' ]);

			let { status, stdout } = await runAxwaySync([ 'pm', 'purge' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('purge/purged-non-selected'));

			({ status, stdout } = await runAxwaySync([ 'pm', 'list', '--json' ]));
			expect(status).to.equal(0);
			let results = JSON.parse(stdout);
			expect(results).to.have.lengthOf(1);
			expect(results[0].name).to.equal('acs');
			expect(results[0].versions).to.have.property('2.1.9');
		});

		it('should handle no packages to purge', async function () {
			this.timeout(120000);
			this.slow(30000);

			let { status, stdout } = await runAxwaySync([ 'pm', 'purge' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('purge/nothing-to-purge'));

			await runAxwaySync([ 'pm', 'install', 'acs@2.1.10' ]);

			( { status, stdout } = await runAxwaySync([ 'pm', 'purge' ]));
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('purge/nothing-to-purge'));
		});

		it('should error purging a package that is not installed', async function () {
			this.timeout(120000);
			this.slow(30000);

			const { status, stderr } = await runAxwaySync([ 'pm', 'purge', 'acs' ]);
			expect(status).to.equal(1);
			expect(stderr).to.match(renderRegexFromFile('purge/not-installed'));
		});

		it('should output purge help', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'purge', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('purge/help'));
		});
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
			const { status, stderr } = await runAxwaySync([ 'pm', 'view', 'abcdef' ]);
			expect(status).to.equal(1);
			expect(stderr).to.match(renderRegexFromFile('view/not-found'));
		});

		it('should error if package is not found as JSON', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'view', 'abcdef', '--json' ]);
			expect(status).to.equal(1);
			const info = JSON.parse(stdout);
			expect(info).to.deep.equal({
				code: 1,
				result: 'Error: Package "abcdef" not found'
			});
		});

		it('should output view help', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'view', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('view/help'));
		});
	});
});
