import {
	renderRegexFromFile,
	runAxwaySync
} from '../../helpers/index.js';

const deprecationMessage = /Error: The "user" commands are no longer supported as of version 5.0.0. Their references will be removed in a subsequent release./;

describe('axway user', () => {
	describe('help', () => {
		it('should output the help screen using --help flag', async () => {
			const { stdout } = await runAxwaySync([ 'user', '--help' ], { color: true });
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color', {}, { color: true }));
		});
	});

	describe('index', () => {
		it('should show as no longer supported', async () => {
			const { stderr } = await runAxwaySync([ 'user' ]);
			expect(stderr.toString()).to.match(deprecationMessage);
		});
	});

	describe('activity', () => {
		it('should show as no longer supported', async () => {
			const { stderr } = await runAxwaySync([ 'user', 'activity' ]);
			expect(stderr.toString()).to.match(deprecationMessage);
		});
	});

	describe('credentials', () => {
		it('should show as no longer supported', async () => {
			const { stderr } = await runAxwaySync([ 'user', 'credentials' ]);
			expect(stderr.toString()).to.match(deprecationMessage);
		});
	});

	describe('update', () => {
		it('should show as no longer supported', async () => {
			const { stderr } = await runAxwaySync([ 'user', 'update' ]);
			expect(stderr.toString()).to.match(deprecationMessage);
		});
	});

	describe('view', () => {
		it('should show as no longer supported', async () => {
			const { stderr } = await runAxwaySync([ 'user', 'view' ]);
			expect(stderr.toString()).to.match(deprecationMessage);
		});
	});
});
