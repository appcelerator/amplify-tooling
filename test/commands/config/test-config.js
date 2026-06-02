import {
	initHomeDir,
	renderRegexFromFile,
	resetHomeDir,
	runCommand
} from '../../helpers/index.js';

describe('axway config', () => {
	describe('help', () => {
		after(resetHomeDir);

		it('should output the help screen with color', async () => {
			const { status, stdout } = await runCommand([ 'config' ], { color: true });
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
			expect(status).to.equal(0);
		});

		it('should output the help screen using --help flag', async () => {
			const { status, stdout } = await runCommand([ 'config', '--help' ], { color: true });
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
			expect(status).to.equal(0);
		});
	});

	describe('list', () => {
		afterEach(resetHomeDir);

		it('should list simple config', async () => {
			initHomeDir('home-simple');
			const { status, stdout } = await runCommand([ 'config', 'list' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('list/foo-bar'));
			expect(status).to.equal(0);
		});

		it('should list simple config as JSON', async () => {
			initHomeDir('home-simple');
			const { status, stdout } = await runCommand([ 'config', 'list', '--json' ]);
			expect(JSON.parse(stdout.toString())).to.deep.equal({
				foo: 'bar'
			});
			expect(status).to.equal(0);
		});

		it('should display list help', async () => {
			const { status, stdout } = await runCommand([ 'config', 'list', '--help' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('list/list-help'));
			expect(status).to.equal(0);
		});
	});

	describe('get', () => {
		afterEach(resetHomeDir);

		it('should get simple config', async () => {
			initHomeDir('home-simple');
			const { status, stdout } = await runCommand([ 'config', 'get' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('get/get-all'));
			expect(status).to.equal(0);
		});

		it('should get simple config as JSON', async () => {
			initHomeDir('home-simple');
			const { status, stdout } = await runCommand([ 'config', 'get', '--json' ]);
			expect(JSON.parse(stdout.toString())).to.deep.equal({
				foo: 'bar'
			});
			expect(status).to.equal(0);
		});

		it('should get simple config value', async () => {
			initHomeDir('home-simple');
			const { status, stdout } = await runCommand([ 'config', 'get', 'foo' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('get/get-foo'));
			expect(status).to.equal(0);
		});

		it('should get simple config value as JSON', async () => {
			initHomeDir('home-simple');
			const { status, stdout } = await runCommand([ 'config', 'get', 'foo', '--json' ]);
			expect(JSON.parse(stdout.toString())).to.equal('bar');
			expect(status).to.equal(0);
		});

		it('should get non-existing config value', async () => {
			const { status, stdout } = await runCommand([ 'config', 'get', 'bar' ]);
			expect(stdout.toString()).equal('undefined\n');
			expect(status).to.equal(0);
		});

		it('should get non-existing config value as JSON', async () => {
			const { status, stdout } = await runCommand([ 'config', 'get', 'bar', '--json' ]);
			expect(stdout.toString()).equal('');
			expect(status).to.equal(0);
		});

		it('should display get help', async () => {
			const { status, stdout } = await runCommand([ 'config', 'get', '--help' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('get/get-help'));
			expect(status).to.equal(0);
		});
	});

	describe('set', () => {
		afterEach(resetHomeDir);

		it('should set a value', async () => {
			let { status, stdout } = await runCommand([ 'config', 'get', 'foo' ]);
			expect(stdout.toString()).equal('undefined\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'set', 'foo', 'bar' ]));
			expect(stdout.toString()).equal('OK\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'get', 'foo' ]));
			expect(stdout.toString()).equal('bar\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'set', 'foo', 'baz' ]));
			expect(stdout.toString()).equal('OK\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'get', 'foo' ]));
			expect(stdout.toString()).equal('baz\n');
			expect(status).to.equal(0);
		});

		it('should set a value and output result as JSON', async () => {
			let { status, stdout } = await runCommand([ 'config', 'get', 'foo' ]);
			expect(stdout.toString()).equal('undefined\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'set', 'foo', 'bar', '--json' ]));
			expect(stdout.toString()).equal('"OK"\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'get', 'foo' ]));
			expect(stdout.toString()).equal('bar\n');
			expect(status).to.equal(0);
		});

		it('should error setting a value without a key', async () => {
			const { status, stderr } = await runCommand([ 'config', 'set' ]);
			expect(stderr.toString()).to.match(renderRegexFromFile('set/set-value-no-key-stderr'));
			expect(status).to.equal(2);
		});

		it('should error setting a value without a value', async () => {
			const { status, stderr } = await runCommand([ 'config', 'set', 'foo' ]);
			expect(stderr.toString()).to.match(renderRegexFromFile('set/set-value-no-value-stderr'));
			expect(status).to.equal(2);
		});

		it('should display set help', async () => {
			const { status, stdout } = await runCommand([ 'config', 'set', '--help' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('set/set-help'));
			expect(status).to.equal(0);
		});
	});

	describe('delete', () => {
		afterEach(resetHomeDir);

		it('should delete a value', async () => {
			let { status, stdout } = await runCommand([ 'config', 'get', 'foo' ]);
			expect(stdout.toString()).equal('undefined\n');
			expect(status).to.equal(0);

			await runCommand([ 'config', 'set', 'foo', 'bar' ]);

			({ status, stdout } = await runCommand([ 'config', 'delete', 'foo' ]));
			expect(stdout.toString()).equal('OK\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'get', 'foo' ]));
			expect(stdout.toString()).equal('undefined\n');
			expect(status).to.equal(0);
		});

		it('should delete a value and output result as JSON', async () => {
			let { status, stdout } = await runCommand([ 'config', 'get', 'foo' ]);
			expect(stdout.toString()).equal('undefined\n');
			expect(status).to.equal(0);

			await runCommand([ 'config', 'set', 'foo', 'bar' ]);

			({ status, stdout } = await runCommand([ 'config', 'delete', 'foo', '--json' ]));
			expect(stdout.toString()).equal('"OK"\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'get', 'foo' ]));
			expect(stdout.toString()).equal('undefined\n');
			expect(status).to.equal(0);
		});

		it('should delete a value that does not exist', async () => {
			const { status, stdout } = await runCommand([ 'config', 'delete', 'foo' ]);
			expect(stdout.toString()).to.equal('OK\n');
			expect(status).to.equal(0);
		});

		it('should error deleting a value without a key', async () => {
			const { status, stderr } = await runCommand([ 'config', 'set' ]);
			expect(stderr.toString()).to.match(renderRegexFromFile('delete/delete-value-no-key-stderr'));
			expect(status).to.equal(2);
		});

		it('should display delete help', async () => {
			const { status, stdout } = await runCommand([ 'config', 'delete', '--help' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('delete/delete-help'));
			expect(status).to.equal(0);
		});
	});

	describe('push', () => {
		afterEach(resetHomeDir);

		it('should push a new value', async () => {
			let { status, stdout } = await runCommand([ 'config', 'get', 'foo' ]);
			expect(stdout.toString()).equal('undefined\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'push', 'foo', 'bar' ]));
			expect(stdout.toString()).equal('OK\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'get', 'foo' ]));
			expect(stdout.toString()).equal('foo.0 = bar\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'get', 'foo', '--json' ]));
			expect(stdout.toString()).match(/\[\s*"bar"\s*\]/);
			expect(status).to.equal(0);
		});

		it('should push an existing array value', async () => {
			let { status, stdout } = await runCommand([ 'config', 'push', 'foo', 'bar' ]);
			expect(stdout.toString()).equal('OK\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'push', 'foo', 'baz' ]));
			expect(stdout.toString()).equal('OK\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'get', 'foo' ]));
			expect(stdout.toString()).equal('foo.0 = bar\nfoo.1 = baz\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'get', 'foo', '--json' ]));
			expect(stdout.toString()).match(/\[\s*"bar",\s*"baz"\s*\]/);
			expect(status).to.equal(0);
		});

		it('should convert existing value to array and push a new value', async () => {
			let { status, stdout } = await runCommand([ 'config', 'set', 'foo', 'bar' ]);
			expect(stdout.toString()).equal('OK\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'push', 'foo', 'baz' ]));
			expect(stdout.toString()).equal('OK\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'get', 'foo' ]));
			expect(stdout.toString()).equal('foo.0 = bar\nfoo.1 = baz\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'get', 'foo', '--json' ]));
			expect(stdout.toString()).match(/\[\s*"bar",\s*"baz"\s*\]/);
			expect(status).to.equal(0);
		});

		it('should error pushing a value without a key', async () => {
			const { status, stderr } = await runCommand([ 'config', 'push' ]);
			expect(stderr.toString()).to.match(renderRegexFromFile('push/push-value-no-key-stderr'));
			expect(status).to.equal(2);
		});

		it('should error pushing a value without a value', async () => {
			const { status, stderr } = await runCommand([ 'config', 'push', 'foo' ]);
			expect(stderr.toString()).to.match(renderRegexFromFile('push/push-value-no-value-stderr'));
			expect(status).to.equal(2);
		});

		it('should display push help', async () => {
			const { status, stdout } = await runCommand([ 'config', 'push', '--help' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('push/push-help'));
			expect(status).to.equal(0);
		});
	});

	describe('pop', () => {
		afterEach(resetHomeDir);

		it('should pop a value from an existing array value', async () => {
			let { status, stdout } = await runCommand([ 'config', 'push', 'foo', 'bar' ]);
			expect(stdout.toString()).equal('OK\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'push', 'foo', 'baz' ]));
			expect(stdout.toString()).equal('OK\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'pop', 'foo' ]));
			expect(stdout.toString()).equal('baz\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'pop', 'foo' ]));
			expect(stdout.toString()).equal('bar\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'pop', 'foo' ]));
			expect(stdout.toString()).equal('undefined\n');
			expect(status).to.equal(0);
		});

		it('should pop a value from an existing non-array value', async () => {
			let { status, stdout } = await runCommand([ 'config', 'set', 'foo', 'bar' ]);
			expect(stdout.toString()).equal('OK\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'pop', 'foo' ]));
			expect(stdout.toString()).equal('bar\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'pop', 'foo' ]));
			expect(stdout.toString()).equal('undefined\n');
			expect(status).to.equal(0);
		});

		it('should error popping a non-existing key', async () => {
			let { status, stdout } = await runCommand([ 'config', 'pop', 'foo' ]);
			expect(stdout.toString()).equal('undefined\n');
			expect(status).to.equal(0);
		});

		it('should error popping a value without a key', async () => {
			const { status, stderr } = await runCommand([ 'config', 'pop' ]);
			expect(stderr.toString()).to.match(renderRegexFromFile('pop/pop-value-no-key-stderr'));
			expect(status).to.equal(2);
		});

		it('should display pop help', async () => {
			const { status, stdout } = await runCommand([ 'config', 'pop', '--help' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('pop/pop-help'));
			expect(status).to.equal(0);
		});
	});

	describe('shift', () => {
		afterEach(resetHomeDir);

		it('should shift a value from an existing array value', async () => {
			let { status, stdout } = await runCommand([ 'config', 'push', 'foo', 'bar' ]);
			expect(stdout.toString()).equal('OK\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'push', 'foo', 'baz' ]));
			expect(stdout.toString()).equal('OK\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'shift', 'foo' ]));
			expect(stdout.toString()).equal('bar\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'shift', 'foo' ]));
			expect(stdout.toString()).equal('baz\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'shift', 'foo' ]));
			expect(stdout.toString()).equal('undefined\n');
			expect(status).to.equal(0);
		});

		it('should shift a value from an existing non-array value', async () => {
			let { status, stdout } = await runCommand([ 'config', 'set', 'foo', 'bar' ]);
			expect(stdout.toString()).equal('OK\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'shift', 'foo' ]));
			expect(stdout.toString()).equal('bar\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'shift', 'foo' ]));
			expect(stdout.toString()).equal('undefined\n');
			expect(status).to.equal(0);
		});

		it('should error shifting a non-existing key', async () => {
			let { status, stdout } = await runCommand([ 'config', 'shift', 'foo' ]);
			expect(stdout.toString()).equal('undefined\n');
			expect(status).to.equal(0);
		});

		it('should error shifting a value without a key', async () => {
			const { status, stderr } = await runCommand([ 'config', 'shift' ]);
			expect(stderr.toString()).to.match(renderRegexFromFile('shift/shift-value-no-key-stderr'));
			expect(status).to.equal(2);
		});

		it('should display shift help', async () => {
			const { status, stdout } = await runCommand([ 'config', 'shift', '--help' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('shift/shift-help'));
			expect(status).to.equal(0);
		});
	});

	describe('unshift', () => {
		afterEach(resetHomeDir);

		it('should unshift a new value', async () => {
			let { status, stdout } = await runCommand([ 'config', 'get', 'foo' ]);
			expect(stdout.toString()).equal('undefined\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'unshift', 'foo', 'bar' ]));
			expect(stdout.toString()).equal('OK\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'get', 'foo' ]));
			expect(stdout.toString()).equal('foo.0 = bar\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'get', 'foo', '--json' ]));
			expect(stdout.toString()).match(/\[\s*"bar"\s*\]/);
			expect(status).to.equal(0);
		});

		it('should unshift an existing array value', async () => {
			let { status, stdout } = await runCommand([ 'config', 'unshift', 'foo', 'bar' ]);
			expect(stdout.toString()).equal('OK\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'unshift', 'foo', 'baz' ]));
			expect(stdout.toString()).equal('OK\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'get', 'foo' ]));
			expect(stdout.toString()).equal('foo.0 = baz\nfoo.1 = bar\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'get', 'foo', '--json' ]));
			expect(stdout.toString()).match(/\[\s*"baz",\s*"bar"\s*\]/);
			expect(status).to.equal(0);
		});

		it('should convert existing value to array and unshift a new value', async () => {
			let { status, stdout } = await runCommand([ 'config', 'set', 'foo', 'bar' ]);
			expect(stdout.toString()).equal('OK\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'unshift', 'foo', 'baz' ]));
			expect(stdout.toString()).equal('OK\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'get', 'foo' ]));
			expect(stdout.toString()).equal('foo.0 = baz\nfoo.1 = bar\n');
			expect(status).to.equal(0);

			({ status, stdout } = await runCommand([ 'config', 'get', 'foo', '--json' ]));
			expect(stdout.toString()).match(/\[\s*"baz",\s*"bar"\s*\]/);
			expect(status).to.equal(0);
		});

		it('should error unshifting a value without a key', async () => {
			const { status, stderr } = await runCommand([ 'config', 'unshift' ]);
			expect(stderr.toString()).to.match(renderRegexFromFile('unshift/unshift-value-no-key-stderr'));
			expect(status).to.equal(2);
		});

		it('should error unshifting a value without a value', async () => {
			const { status, stderr } = await runCommand([ 'config', 'unshift', 'foo' ]);
			expect(stderr.toString()).to.match(renderRegexFromFile('unshift/unshift-value-no-value-stderr'));
			expect(status).to.equal(2);
		});

		it('should display unshift help', async () => {
			const { status, stdout } = await runCommand([ 'config', 'unshift', '--help' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('unshift/unshift-help'));
			expect(status).to.equal(0);
		});
	});
});
