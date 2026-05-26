import { runAxwaySync, renderRegexFromFile } from '../../../helpers/index.js';
import {
	engageEnv,
	setupEngageAuth,
	initHomeDir,
	resetHomeDir,
} from '../../../helpers/engage-test-helper.js';

describe('axway engage install', () => {
	describe('help', () => {
		it('should output the help screen', async () => {
			const { status, stdout } = await runAxwaySync([ 'engage', 'install', '--help' ]);
			expect(stdout).to.match(renderRegexFromFile('templates/help'));
			expect(status).to.equal(0);
		});
	});

	describe('no resource type', () => {
		it('should error when no resource type is specified', async () => {
			const { status, stderr } = await runAxwaySync([ 'engage', 'install' ]);
			expect(status).to.equal(1);
			expect(stderr).to.match(renderRegexFromFile('templates/no-resource-type'));
		});
	});

	describe('auth required', () => {
		afterEach(resetHomeDir);

		it('should error if not authenticated when trying install agents', async () => {
			initHomeDir('home-local');
			const { status, stderr } = await runAxwaySync(
				[ 'engage', 'install', 'agents' ],
				{ env: engageEnv }
			);
			expect(status).to.equal(1);
			expect(stderr).to.include('Error');
		});
	});

	describe('authenticated', () => {
		beforeEach(async function () {
			await setupEngageAuth.call(this);
		});

		afterEach(resetHomeDir);

		describe('install agents', () => {
			it('should output help for agents subcommand', async () => {
				const { status, stdout } = await runAxwaySync([ 'engage', 'install', 'agents', '--help' ]);
				expect(stdout).to.match(renderRegexFromFile('templates/agents-help'));
				expect(status).to.equal(0);
			});
		});
	});
});
