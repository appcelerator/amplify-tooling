import { runHook } from '@oclif/test';
import { stdin as mockStdin } from 'mock-stdin';

const stdin = mockStdin();
const promptStdinDelay = 150;

describe('Hooks - Command Not Found', () => {
	it('Should output version when shorthand -v is used', async () => {
		const { stdout, error } = await runHook('command_not_found', { id: '-v', argv: [ '-v' ] });

		expect(error).to.equal(undefined);
		expect(stdout.toString()).to.match(/\d\.\d\.\d(-[^\s]*)?/);
	});

	it('Should error with no close matches', async () => {
		const { error } = await runHook('command_not_found', { id: 'completely:invalid:command' });

		expect(error.message).to.include('Command "completely invalid command" not found.');
	});

	it('Should not run a suggestion if prompt is declined', async () => {
		const prevAxwayTest = process.env.AXWAY_TEST;
		process.env.AXWAY_TEST = '2'; // Set test env to force prompt in non-TTY

		// Send a 'no' response to the prompt
		setTimeout(() => stdin.send('N\n'), promptStdinDelay);

		const { stdout } = await runHook('command_not_found', { id: 'athu' });

		expect(stdout).to.include('Did you mean "auth"? Command will execute in 5s... (Y/n)');
		expect(stdout).to.include('Did you mean "auth"? Command will execute in 5s... No');
		process.env.AXWAY_TEST = prevAxwayTest;
	});

	it('Should run a suggestion if prompt is accepted', async () => {
		const prevAxwayTest = process.env.AXWAY_TEST;
		process.env.AXWAY_TEST = '2'; // Set test env to force prompt in non-TTY

		// Send a 'yes' response to the prompt
		setTimeout(() => stdin.send('Y\n'), promptStdinDelay);

		try {
			const { stdout } = await runHook('command_not_found', { id: 'athu' });

			expect(stdout).to.include('Did you mean "auth"? Command will execute in 5s... (Y/n)');
			expect(stdout).to.include('Did you mean "auth"? Command will execute in 5s... Yes');
			// Expect the "auth" command help text to be included
			expect(stdout).to.include('Manage Axway CLI authentication.');
		} finally {
			process.env.AXWAY_TEST = prevAxwayTest;
		}
	});

	it('Should run a suggestion if prompt is not answered after 5 seconds', async function () {
		this.timeout(7000); // Increase timeout for this test

		const prevAxwayTest = process.env.AXWAY_TEST;
		process.env.AXWAY_TEST = '2'; // Set test env to force prompt in non-TTY

		try {
			const startTime = Date.now();
			const { stdout } = await runHook('command_not_found', { id: 'athu' });
			const endTime = Date.now();

			expect(stdout).to.include('Did you mean "auth"? Command will execute in 5s... (Y/n)');
			// Expect the "auth" command help text to be included
			expect(stdout).to.include('Manage Axway CLI authentication.');
			expect(endTime - startTime).to.be.gte(5000);
		} finally {
			process.env.AXWAY_TEST = prevAxwayTest;
		}
	});
});
