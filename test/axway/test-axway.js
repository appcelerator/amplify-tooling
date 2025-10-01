import {
	renderRegexFromFile,
	resetHomeDir,
	runAxwaySync
} from '../helpers/index.js';

describe('axway', () => {
	describe('help', () => {
		after(resetHomeDir);

		it('should output the help screen with color', async () => {
			const { status, stdout } = await runAxwaySync();
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
			expect(status).to.equal(2);
		});

		it('should output the help screen without color', async () => {
			const { status, stdout } = await runAxwaySync([ '--no-color' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-without-color'));
			expect(status).to.equal(2);
		});

		it('should output the help as JSON', async () => {
			const { status, stdout } = await runAxwaySync([ '--json' ]);

			const help = JSON.parse(stdout.toString());
			expect(help).to.be.an('object');
			expect(help.desc).to.equal('The Axway CLI is a unified command line interface for the Axway Amplify Platform.');
			expect(help.usage).to.deep.equal({
				title: 'Usage',
				text: 'axway <command> [options]'
			});
			expect(status).to.equal(2);
		});

		it('should list suggestions if command does not exist', async () => {
			const { status, stdout, stderr } = await runAxwaySync([ 'athu' ]);
			expect(status).to.equal(1);
			expect(stdout.toString()).to.match(renderRegexFromFile('bad-command/bad-command-with-suggestions-stdout'));
			expect(stderr.toString()).to.match(renderRegexFromFile('bad-command/bad-command-with-suggestions-stderr'));
		});

		it('should error if command does not exist', async () => {
			const { status, stdout, stderr } = await runAxwaySync([ 'foo' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('bad-command/bad-command-stdout'));
			expect(stderr.toString()).to.match(renderRegexFromFile('bad-command/bad-command-stderr'));
			expect(status).to.equal(1);
		});
	});

	describe('banner', () => {
		it('should output the help without the banner', async () => {
			const { status, stdout } = await runAxwaySync([ '--no-banner' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color-no-banner'));
			expect(status).to.equal(2);
		});

		it('should show 32-bit deprecation warning', async () => {
			const { status, stdout } = await runAxwaySync([], { shim: 'arch-shim-ia32' });
			expect(stdout.toString()).to.match(renderRegexFromFile('help/32-bit-deprecation'));
			expect(status).to.equal(2);
		});

		it('should show unsupported architecture warning', async () => {
			const { status, stdout } = await runAxwaySync([], { shim: 'arch-shim-arm' });
			expect(stdout.toString()).to.match(renderRegexFromFile('help/unsupported-arch'));
			expect(status).to.equal(2);
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
