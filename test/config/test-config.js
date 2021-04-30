import {
	initHomeDir,
	renderRegexFromFile,
	resetHomeDir,
	runAxwaySync
} from '../helpers';

describe('axway config', () => {
	describe('help', () => {
		after(resetHomeDir);

		it('should output the help screen with color', async () => {
			const { status, stdout } = runAxwaySync([ 'config' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help-with-color'));
		});

		it('should output the help screen using --help flag', async () => {
			const { status, stdout } = runAxwaySync([ 'config', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help-with-color'));
		});
	});

	describe('list', () => {
		afterEach(resetHomeDir);

		it('should list simple config', async () => {
			initHomeDir('simple');
			const { status, stdout } = runAxwaySync([ 'config', 'list' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('simple/output'));
		});

		it('should list simple config as JSON', async () => {
			initHomeDir('simple');
			const { status, stdout } = runAxwaySync([ 'config', 'list', '--json' ]);
			expect(status).to.equal(0);
			expect(JSON.parse(stdout.toString())).to.deep.equal({
				foo: 'bar'
			});
		});

		it('should handle bad config', async () => {
			initHomeDir('bad-config');
			const { status, stdout } = runAxwaySync([ 'config', 'list' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.equal('');
		});
	});

	describe('get', () => {
		afterEach(resetHomeDir);

		it('should get simple config', async () => {
			initHomeDir('simple');
			const { status, stdout } = runAxwaySync([ 'config', 'get' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('simple/output'));
		});

		it('should get simple config as JSON', async () => {
			initHomeDir('simple');
			const { status, stdout } = runAxwaySync([ 'config', 'get', '--json' ]);
			expect(status).to.equal(0);
			expect(JSON.parse(stdout.toString())).to.deep.equal({
				foo: 'bar'
			});
		});

		it('should get simple config value', async () => {
			initHomeDir('simple');
			const { status, stdout } = runAxwaySync([ 'config', 'get', 'foo' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.equal('bar\n');
		});

		it('should get simple config value as JSON', async () => {
			initHomeDir('simple');
			const { status, stdout } = runAxwaySync([ 'config', 'get', 'foo', '--json' ]);
			expect(status).to.equal(0);
			expect(JSON.parse(stdout.toString())).to.equal('bar');
		});

		it('should get non-existing config value', async () => {
			const { status, stdout } = runAxwaySync([ 'config', 'get', 'bar' ]);
			expect(status).to.equal(6);
			expect(stdout.toString()).equal('undefined\n');
		});

		it('should get non-existing config value as JSON', async () => {
			const { status, stdout } = runAxwaySync([ 'config', 'get', 'bar', '--json' ]);
			expect(status).to.equal(6);
			expect(stdout.toString()).equal('undefined\n');
		});
	});

	describe('set', () => {
		//
	});

	describe('delete', () => {
		//
	});

	describe('push', () => {
		//
	});

	describe('pop', () => {
		//
	});

	describe('shift', () => {
		//
	});

	describe('unshift', () => {
		//
	});
});
