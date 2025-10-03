import {
	renderRegexFromFile,
	resetHomeDir,
	runAxwaySync
} from '../helpers/index.js';

describe('axway user', () => {
	describe('help', () => {
		after(resetHomeDir);

		it('should output the help screen with color', async () => {
			const { status, stdout } = await runAxwaySync([ 'user' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
			expect(status).to.equal(2);
		});

		it('should output the help screen using --help flag', async () => {
			const { status, stdout } = await runAxwaySync([ 'user', '--help' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
			expect(status).to.equal(2);
		});
	});

	describe('activity', () => {
		it('should show as no longer supported', async () => {
			const { status, stderr } = await runAxwaySync([ 'user', 'activity' ]);
			expect(stderr.toString()).to.match(renderRegexFromFile('not-supported'));
			expect(status).to.equal(1);
		});
	});

	describe('credentials', () => {
		it('should show as no longer supported', async () => {
			const { status, stderr } = await runAxwaySync([ 'user', 'credentials' ]);
			expect(stderr.toString()).to.match(renderRegexFromFile('not-supported'));
			expect(status).to.equal(1);
		});
	});

	describe('update', () => {
		it('should show as no longer supported', async () => {
			const { status, stderr } = await runAxwaySync([ 'user', 'update' ]);
			expect(stderr.toString()).to.match(renderRegexFromFile('not-supported'));
			expect(status).to.equal(1);
		});
	});

	describe('view', () => {
		it('should show as no longer supported', async () => {
			const { status, stderr } = await runAxwaySync([ 'user', 'view' ]);
			expect(stderr.toString()).to.match(renderRegexFromFile('not-supported'));
			expect(status).to.equal(1);
		});
	});
});
