import { runHook } from '@oclif/test';
import check, { clearPendingCheck } from '../../../dist/lib/update.js';

describe('Hooks - Finally', () => {
	afterEach(async () => {
		// Unset the pendingCheck so we can test it here
		clearPendingCheck();
	});

	it('Outputs the update banner by default', async () => {
		// Set the pendingCheck so we can verify it was created
		await check({
			force: true,
			pkg: { name: 'axway', version: '1.0.0' }
		});

		const { stdout } = await runHook('finally', { argv: [] })
		expect(stdout).to.include('AXWAY CLI UPDATE AVAILABLE');
	});

	it('Should not output the update banner if no updates are available', async () => {
		// Set the pendingCheck so we can verify it was created
		await check({
			force: true,
			pkg: { name: 'axway', version: '999.0.0' }
		});

		const { stdout } = await runHook('finally', { argv: [] })
		expect(stdout).to.equal('');
	});

	it('Should not output the update banner with the --no-banner argument', async () => {
		// Set the pendingCheck so we can verify it was created
		await check({
			force: true,
			pkg: { name: 'axway', version: '1.0.0' }
		});

		const { stdout } = await runHook('finally', { argv: [ '--no-banner' ] })
		expect(stdout).to.equal('');
	});

	it('Should not output the update banner with the --json argument', async () => {
		// Set the pendingCheck so we can verify it was created
		await check({
			force: true,
			pkg: { name: 'axway', version: '1.0.0' }
		});

		const { stdout } = await runHook('finally', { argv: [ '--json' ] })
		expect(stdout).to.equal('');
	});
})
