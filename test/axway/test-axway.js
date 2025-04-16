import {
	renderRegexFromFile,
	resetHomeDir,
	runAxwaySync
} from '../helpers';

describe('axway', () => {
	describe('help', () => {
		after(resetHomeDir);

		it('should output the help screen with color', async () => {
			const { status, stdout } = await runAxwaySync();
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
		});

		it('should output the help screen without color', async () => {
			const { status, stdout } = await runAxwaySync([ '--no-color' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-without-color'));
		});

		it('should output the help as JSON', async () => {
			const { status, stdout } = await runAxwaySync([ '--json' ]);
			expect(status).to.equal(2);

			const help = JSON.parse(stdout.toString());
			expect(help).to.be.an('object');
			expect(help.desc).to.equal('The Axway CLI is a unified command line interface for the Axway Amplify Platform.');
			expect(help.usage).to.deep.equal({
				title: 'Usage',
				text: 'axway <command> [options]'
			});
		});

		it('should list suggestions if command does not exist', async () => {
			const { status, stdout, stderr } = await runAxwaySync([ 'athu' ]);
			expect(status).to.equal(1);
			expect(stdout.toString()).to.match(renderRegexFromFile('bad-command/bad-command-with-suggestions-stdout'));
			expect(stderr.toString()).to.match(renderRegexFromFile('bad-command/bad-command-with-suggestions-stderr'));
		});

		it('should error if command does not exist', async () => {
			const { status, stdout, stderr } = await runAxwaySync([ 'foo' ]);
			expect(status).to.equal(1);
			expect(stdout.toString()).to.match(renderRegexFromFile('bad-command/bad-command-stdout'));
			expect(stderr.toString()).to.match(renderRegexFromFile('bad-command/bad-command-stderr'));
		});
	});

	describe('banner', () => {
		it('should output the help without the banner', async () => {
			const { status, stdout } = await runAxwaySync([ '--no-banner' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color-no-banner'));
		});

		it('should show 32-bit deprecation warning', async () => {
			const { status, stdout } = await runAxwaySync([], { shim: 'arch-shim-ia32' });
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/32-bit-deprecation'));
		});

		it('should show unsupported architecture warning', async () => {
			const { status, stdout } = await runAxwaySync([], { shim: 'arch-shim-arm' });
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/unsupported-arch'));
		});
	});

	describe('version', () => {
		it('should display the version', async () => {
			let { status, stdout } = await runAxwaySync([ '-v' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(/\d\.\d\.\d(-[^\s]*)?/);

			({ status, stdout } = await runAxwaySync([ '--version' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(/\d\.\d\.\d(-[^\s]*)?/);
		});
	});
});
