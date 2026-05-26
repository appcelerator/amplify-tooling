import {
	renderRegexFromFile,
	resetHomeDir,
	runAxwaySync
} from '../../helpers/index.js';

describe('axway', () => {
	describe('help', () => {
		after(resetHomeDir);

		it('should output the help screen with color', async () => {
			const { status, stdout } = await runAxwaySync([], { color: true });
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
			expect(status).to.equal(0);
		});

		it('should output the help screen without color', async () => {
			const { status, stdout } = await runAxwaySync([ '--help', '--no-color' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-without-color'));
			expect(status).to.equal(0);
		});

		it('should list suggestions if command does not exist', async () => {
			const { status, stderr } = await runAxwaySync([ 'athu' ]);
			expect(stderr.toString()).to.match(renderRegexFromFile('bad-command/bad-command-with-suggestions-stderr'));
			expect(status).to.equal(2);
		});

		it('should error if command does not exist', async () => {
			const { status, stderr } = await runAxwaySync([ 'foo' ]);
			expect(stderr.toString()).to.match(renderRegexFromFile('bad-command/bad-command-stderr'));
			expect(status).to.equal(2);
		});
	});

	describe('banner', () => {
		it('should output the help without the banner', async () => {
			const { status, stdout } = await runAxwaySync([ '--help', '--no-banner' ], { color: true });
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color-no-banner'));
			expect(status).to.equal(0);
		});
	});

	describe('version', () => {
		it('should display the version', async () => {
			let { status, stdout } = await runAxwaySync([ '-v' ]);
			expect(stdout.toString()).to.match(/\d\.\d\.\d(-[^\s]*)?/);
			expect(status).to.equal(0);

			({ status, stdout } = await runAxwaySync([ '--version' ]));
			expect(stdout.toString()).to.match(/\d\.\d\.\d(-[^\s]*)?/);
			expect(status).to.equal(0);
		});
	});
});
