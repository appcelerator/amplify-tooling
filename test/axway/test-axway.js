import {
	renderRegexFromFile,
	resetHomeDir,
	runAxwaySync
} from '../helpers';

describe('axway', () => {
	describe('help', () => {
		after(resetHomeDir);

		it('should output the help screen with color', async () => {
			const { status, stdout } = runAxwaySync();
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
		});

		it('should output the help screen without color', async () => {
			const { status, stdout } = runAxwaySync([ '--no-color' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-without-color'));
		});

		it('should output the help as JSON', async () => {
			const { status, stdout } = runAxwaySync([ '--json' ]);
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
			const { status, stdout, stderr } = runAxwaySync([ 'athu' ]);
			expect(status).to.equal(1);
			expect(stdout.toString()).to.match(renderRegexFromFile('bad-command/bad-command-with-suggestions-stdout'));
			expect(stderr.toString()).to.match(renderRegexFromFile('bad-command/bad-command-with-suggestions-stderr'));
		});

		it('should error if command does not exist', async () => {
			const { status, stdout, stderr } = runAxwaySync([ 'foo' ]);
			expect(status).to.equal(1);
			expect(stdout.toString()).to.match(renderRegexFromFile('bad-command/bad-command-stdout'));
			expect(stderr.toString()).to.match(renderRegexFromFile('bad-command/bad-command-stderr'));
		});
	});

	describe('banner', () => {
		it('should output the help without the banner', async () => {
			const { status, stdout } = runAxwaySync([ '--no-banner' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color-no-banner'));
		});
	});

	describe('version', () => {
		it('should display the version', async () => {
			let { status, stdout } = runAxwaySync([ '-v' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(/\d\.\d\.\d(-[^\s]*)?/);

			({ status, stdout } = runAxwaySync([ '--version' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(/\d\.\d\.\d(-[^\s]*)?/);
		});
	});
});
