import {
	initHomeDir,
	renderRegexFromFile,
	resetHomeDir,
	runAxway,
	runAxwaySync,
	startServers,
	stopServers
} from '../helpers';

describe('axway service-account', () => {
	describe('help', () => {
		it('should output the help screen with color', async () => {
			const { status, stdout } = await runAxwaySync([ 'service-account' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('help/help'));
		});

		it('should output the help screen using --help flag', async () => {
			const { status, stdout } = await runAxwaySync([ 'service-account', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('help/help'));
		});
	});
});
