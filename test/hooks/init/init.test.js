import { runHook } from '@oclif/test';
import * as update from '../../../dist/lib/update.js';
import * as config from '../../../dist/lib/config.js';

describe('Hooks - Init', () => {
	it('Outputs the banner by default', async () => {
		const { stdout } = await runHook('init', { argv: [] })
		expect(stdout).to.match(/AXWAY CLI, version [\d.]+\nCopyright \(c\) 2018-\d{4}, Axway, Inc\. All Rights Reserved\.\n/);
		// Verify the update check was started
		expect(update.pendingCheck).to.be.an.instanceof(Promise);
		// Verify the config was loaded
		expect(config.singletonConfig).to.be.an.instanceof(config.Config);
	});

	it('Hides the banner with the --no-banner argument', async () => {
		const { stdout } = await runHook('init', { argv: ['--no-banner'] })
		expect(stdout).to.equal('');
	});

	it('Hides the banner with the --json argument', async () => {
		const { stdout } = await runHook('init', { argv: ['--json'] })
		expect(stdout).to.equal('');
	});
})
