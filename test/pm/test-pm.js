import {
	renderRegexFromFile,
	resetHomeDir,
	runAxwaySync
} from '../helpers';

describe.only('axway pm', () => {
	describe('help', () => {
		after(resetHomeDir);

		it('should output the help screen with color', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/with-color'));
		});

		it('should output the help screen using --help flag', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/with-color'));
		});
	});

	describe('list', () => {
		after(resetHomeDir);

		it('should output no installed packages', async () => {
			const { status, stdout } = await runAxwaySync([ 'pm', 'list' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('list/no-packages'));
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
			expect(stdout.toString()).to.match(renderRegexFromFile('list/help'));
		});
	});

	describe('search', () => {
		//
	});

	describe('view', () => {
		//
	});
});
