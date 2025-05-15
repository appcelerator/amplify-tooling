import {
	initHomeDir,
	renderRegexFromFile,
	resetHomeDir,
	runAxwaySync
} from '../helpers/index.js';

describe('axway config', () => {
	// describe('help', () => {
	// 	after(resetHomeDir);

	// 	it('should output the help screen with color', async () => {
	// 		const { status, stdout } = await runAxwaySync([ 'config' ]);
	// 		expect(status).to.equal(2);
	// 		expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
	// 	});

	// 	it('should output the help screen using --help flag', async () => {
	// 		const { status, stdout } = await runAxwaySync([ 'config', '--help' ]);
	// 		expect(status).to.equal(2);
	// 		expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
	// 	});
	// });

	describe('list', () => {
		afterEach(resetHomeDir);

		it('should list simple config', async () => {
			initHomeDir('home-simple');
			const { status, stdout } = await runAxwaySync([ 'config', 'list' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('list/foo-bar'));
		});

		it('should list simple config as JSON', async () => {
			initHomeDir('home-simple');
			const { status, stdout } = await runAxwaySync([ 'config', 'list', '--json' ]);
			expect(status).to.equal(0);
			expect(JSON.parse(stdout.toString())).to.deep.equal({
				foo: 'bar'
			});
		});

		it('should display list help', async () => {
			const { status, stdout } = await runAxwaySync([ 'config', 'list', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('list/list-help'));
		});
	});

	describe('get', () => {
		afterEach(resetHomeDir);

		it('should get simple config', async () => {
			initHomeDir('home-simple');
			const { status, stdout } = await runAxwaySync([ 'config', 'get' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('list/foo-bar'));
		});

		it('should get simple config as JSON', async () => {
			initHomeDir('home-simple');
			const { status, stdout } = await runAxwaySync([ 'config', 'get', '--json' ]);
			expect(status).to.equal(0);
			expect(JSON.parse(stdout.toString())).to.deep.equal({
				foo: 'bar'
			});
		});

		it('should get simple config value', async () => {
			initHomeDir('home-simple');
			const { status, stdout } = await runAxwaySync([ 'config', 'get', 'foo' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.equal('bar\n');
		});

		it('should get simple config value as JSON', async () => {
			initHomeDir('home-simple');
			const { status, stdout } = await runAxwaySync([ 'config', 'get', 'foo', '--json' ]);
			expect(status).to.equal(0);
			expect(JSON.parse(stdout.toString())).to.equal('bar');
		});

		it('should get non-existing config value', async () => {
			const { status, stdout } = await runAxwaySync([ 'config', 'get', 'bar' ]);
			expect(status).to.equal(6);
			expect(stdout.toString()).equal('\u001b[90mundefined\u001b[39m\n');
		});

		it('should get non-existing config value as JSON', async () => {
			const { status, stdout } = await runAxwaySync([ 'config', 'get', 'bar', '--json' ]);
			expect(status).to.equal(6);
			expect(stdout.toString()).equal('\u001b[90mundefined\u001b[39m\n');
		});

		it('should display get help', async () => {
			const { status, stdout } = await runAxwaySync([ 'config', 'get', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('get/get-help'));
		});
	});

	describe('set', () => {
		afterEach(resetHomeDir);

		it('should set a value', async () => {
			let { status, stdout } = await runAxwaySync([ 'config', 'get', 'foo' ]);
			expect(status).to.equal(6);
			expect(stdout.toString()).equal('\u001b[90mundefined\u001b[39m\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'set', 'foo', 'bar' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('OK\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'get', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('bar\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'set', 'foo', 'baz' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('OK\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'get', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('baz\n');
		});

		it('should set a value and output result as JSON', async () => {
			let { status, stdout } = await runAxwaySync([ 'config', 'get', 'foo' ]);
			expect(status).to.equal(6);
			expect(stdout.toString()).equal('\u001b[90mundefined\u001b[39m\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'set', 'foo', 'bar', '--json' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('"OK"\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'get', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('bar\n');
		});

		it('should error setting a value without a key', async () => {
			const { status, stderr } = await runAxwaySync([ 'config', 'set' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('set/set-value-no-key-stderr'));
		});

		it('should error setting a value without a value', async () => {
			const { status, stderr } = await runAxwaySync([ 'config', 'set', 'foo' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('set/set-value-no-value-stderr'));
		});

		it('should display set help', async () => {
			const { status, stdout } = await runAxwaySync([ 'config', 'set', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('set/set-help'));
		});
	});

	describe('delete', () => {
		afterEach(resetHomeDir);

		it('should delete a value', async () => {
			let { status, stdout } = await runAxwaySync([ 'config', 'get', 'foo' ]);
			expect(status).to.equal(6);
			expect(stdout.toString()).equal('\u001b[90mundefined\u001b[39m\n');

			await runAxwaySync([ 'config', 'set', 'foo', 'bar' ]);

			({ status, stdout } = await runAxwaySync([ 'config', 'delete', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('OK\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'get', 'foo' ]));
			expect(status).to.equal(6);
			expect(stdout.toString()).equal('\u001b[90mundefined\u001b[39m\n');
		});

		it('should delete a value and output result as JSON', async () => {
			let { status, stdout } = await runAxwaySync([ 'config', 'get', 'foo' ]);
			expect(status).to.equal(6);
			expect(stdout.toString()).equal('\u001b[90mundefined\u001b[39m\n');

			await runAxwaySync([ 'config', 'set', 'foo', 'bar' ]);

			({ status, stdout } = await runAxwaySync([ 'config', 'delete', 'foo', '--json' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('"OK"\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'get', 'foo' ]));
			expect(status).to.equal(6);
			expect(stdout.toString()).equal('\u001b[90mundefined\u001b[39m\n');
		});

		it('should delete a value that does not exist', async () => {
			const { status, stdout } = await runAxwaySync([ 'config', 'delete', 'foo' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.equal('OK\n');
		});

		it('should error deleting a value without a key', async () => {
			const { status, stderr } = await runAxwaySync([ 'config', 'set' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('delete/delete-value-no-key-stderr'));
		});

		it('should display delete help', async () => {
			const { status, stdout } = await runAxwaySync([ 'config', 'delete', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('delete/delete-help'));
		});
	});

	describe('push', () => {
		afterEach(resetHomeDir);

		it('should push a new value', async () => {
			let { status, stdout } = await runAxwaySync([ 'config', 'get', 'foo' ]);
			expect(status).to.equal(6);
			expect(stdout.toString()).equal('\u001b[90mundefined\u001b[39m\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'push', 'foo', 'bar' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('OK\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'get', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('foo.0 = bar\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'get', 'foo', '--json' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).match(/\[\s*"bar"\s*\]/);
		});

		it('should push an existing array value', async () => {
			let { status, stdout } = await runAxwaySync([ 'config', 'push', 'foo', 'bar' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('OK\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'push', 'foo', 'baz' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('OK\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'get', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('foo.0 = bar\nfoo.1 = baz\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'get', 'foo', '--json' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).match(/\[\s*"bar",\s*"baz"\s*\]/);
		});

		it('should convert existing value to array and push a new value', async () => {
			let { status, stdout } = await runAxwaySync([ 'config', 'set', 'foo', 'bar' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('OK\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'push', 'foo', 'baz' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('OK\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'get', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('foo.0 = bar\nfoo.1 = baz\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'get', 'foo', '--json' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).match(/\[\s*"bar",\s*"baz"\s*\]/);
		});

		it('should error pushing a value without a key', async () => {
			const { status, stderr } = await runAxwaySync([ 'config', 'push' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('push/push-value-no-key-stderr'));
		});

		it('should error pushing a value without a value', async () => {
			const { status, stderr } = await runAxwaySync([ 'config', 'push', 'foo' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('push/push-value-no-value-stderr'));
		});

		it('should display push help', async () => {
			const { status, stdout } = await runAxwaySync([ 'config', 'push', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('push/push-help'));
		});
	});

	describe('pop', () => {
		afterEach(resetHomeDir);

		it('should pop a value from an existing array value', async () => {
			let { status, stdout } = await runAxwaySync([ 'config', 'push', 'foo', 'bar' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('OK\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'push', 'foo', 'baz' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('OK\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'pop', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('baz\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'pop', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('bar\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'pop', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('\u001b[90mundefined\u001b[39m\n');
		});

		it('should pop a value from an existing non-array value', async () => {
			let { status, stdout } = await runAxwaySync([ 'config', 'set', 'foo', 'bar' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('OK\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'pop', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('bar\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'pop', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('\u001b[90mundefined\u001b[39m\n');
		});

		it('should error popping a non-existing key', async () => {
			let { status, stdout } = await runAxwaySync([ 'config', 'pop', 'foo' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('\u001b[90mundefined\u001b[39m\n');
		});

		it('should error popping a value without a key', async () => {
			const { status, stderr } = await runAxwaySync([ 'config', 'pop' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('pop/pop-value-no-key-stderr'));
		});

		it('should display pop help', async () => {
			const { status, stdout } = await runAxwaySync([ 'config', 'pop', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('pop/pop-help'));
		});
	});

	describe('shift', () => {
		afterEach(resetHomeDir);

		it('should shift a value from an existing array value', async () => {
			let { status, stdout } = await runAxwaySync([ 'config', 'push', 'foo', 'bar' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('OK\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'push', 'foo', 'baz' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('OK\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'shift', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('bar\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'shift', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('baz\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'shift', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('\u001b[90mundefined\u001b[39m\n');
		});

		it('should shift a value from an existing non-array value', async () => {
			let { status, stdout } = await runAxwaySync([ 'config', 'set', 'foo', 'bar' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('OK\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'shift', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('bar\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'shift', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('\u001b[90mundefined\u001b[39m\n');
		});

		it('should error shifting a non-existing key', async () => {
			let { status, stdout } = await runAxwaySync([ 'config', 'shift', 'foo' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('\u001b[90mundefined\u001b[39m\n');
		});

		it('should error shifting a value without a key', async () => {
			const { status, stderr } = await runAxwaySync([ 'config', 'shift' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('shift/shift-value-no-key-stderr'));
		});

		it('should display shift help', async () => {
			const { status, stdout } = await runAxwaySync([ 'config', 'shift', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('shift/shift-help'));
		});
	});

	describe('unshift', () => {
		afterEach(resetHomeDir);

		it('should unshift a new value', async () => {
			let { status, stdout } = await runAxwaySync([ 'config', 'get', 'foo' ]);
			expect(status).to.equal(6);
			expect(stdout.toString()).equal('\u001b[90mundefined\u001b[39m\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'unshift', 'foo', 'bar' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('OK\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'get', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('foo.0 = bar\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'get', 'foo', '--json' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).match(/\[\s*"bar"\s*\]/);
		});

		it('should unshift an existing array value', async () => {
			let { status, stdout } = await runAxwaySync([ 'config', 'unshift', 'foo', 'bar' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('OK\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'unshift', 'foo', 'baz' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('OK\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'get', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('foo.0 = baz\nfoo.1 = bar\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'get', 'foo', '--json' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).match(/\[\s*"baz",\s*"bar"\s*\]/);
		});

		it('should convert existing value to array and unshift a new value', async () => {
			let { status, stdout } = await runAxwaySync([ 'config', 'set', 'foo', 'bar' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('OK\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'unshift', 'foo', 'baz' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('OK\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'get', 'foo' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).equal('foo.0 = baz\nfoo.1 = bar\n');

			({ status, stdout } = await runAxwaySync([ 'config', 'get', 'foo', '--json' ]));
			expect(status).to.equal(0);
			expect(stdout.toString()).match(/\[\s*"baz",\s*"bar"\s*\]/);
		});

		it('should error unshifting a value without a key', async () => {
			const { status, stderr } = await runAxwaySync([ 'config', 'unshift' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('unshift/unshift-value-no-key-stderr'));
		});

		it('should error unshifting a value without a value', async () => {
			const { status, stderr } = await runAxwaySync([ 'config', 'unshift', 'foo' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('unshift/unshift-value-no-value-stderr'));
		});

		it('should display unshift help', async () => {
			const { status, stdout } = await runAxwaySync([ 'config', 'unshift', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('unshift/unshift-help'));
		});
	});
});
