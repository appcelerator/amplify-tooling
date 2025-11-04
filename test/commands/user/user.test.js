import { runCommand } from '@oclif/test';
import { renderRegexFromFile } from '../../helpers/index.js';

const deprecationMessage = 'Error: The "user" commands are no longer supported as of version 5.0.0. Their references will be removed in a subsequent release.';

describe('axway user', () => {
	describe('help', () => {
		it('should output the help screen using --help flag', async () => {
			const { stdout } = await runCommand([ 'user', '--help' ], undefined, { stripAnsi: false });
			expect(stdout).to.match(renderRegexFromFile('help/help-with-color'));
		});
	});

	describe('index', () => {
		it('should show as no longer supported', async () => {
			const { error } = await runCommand('user');
			expect(error.toString()).to.equal(deprecationMessage);
		});
	});

	describe('activity', () => {
		it('should show as no longer supported', async () => {
			const { error } = await runCommand('user activity');
			expect(error.toString()).to.equal(deprecationMessage);
		});
	});

	describe('credentials', () => {
		it('should show as no longer supported', async () => {
			const { error } = await runCommand('user credentials');
			expect(error.toString()).to.equal(deprecationMessage);
		});
	});

	describe('update', () => {
		it('should show as no longer supported', async () => {
			const { error } = await runCommand('user update');
			expect(error.toString()).to.equal(deprecationMessage);
		});
	});

	describe('view', () => {
		it('should show as no longer supported', async () => {
			const { error } = await runCommand('user view');
			expect(error.toString()).to.equal(deprecationMessage);
		});
	});
});
