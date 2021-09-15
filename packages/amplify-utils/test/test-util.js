import path from 'path';

import * as util from '../dist/index';

describe('util', () => {

	describe('arch()', () => {
		beforeEach(function () {
			this.PROCESSOR_ARCHITEW6432 = process.env.PROCESSOR_ARCHITEW6432;
		});

		afterEach(function () {
			delete process.env.AXWAY_TEST_PLATFORM;
			delete process.env.AXWAY_TEST_ARCH;
			this.PROCESSOR_ARCHITEW6432 && (process.env.PROCESSOR_ARCHITEW6432 = this.PROCESSOR_ARCHITEW6432);
		});

		it('should detect the system architecture', () => {
			const a = util.arch();
			expect(a).to.be.oneOf([ 'x86', 'x64' ]);
		});

		it('should cache the architecture', () => {
			process.env.AXWAY_TEST_ARCH = 'x64';
			expect(util.arch(true)).to.equal('x64');

			process.env.AXWAY_TEST_ARCH = 'ia32';
			expect(util.arch()).to.equal('x64');

			if (process.platform === 'linux') {
				// on linux it actually subprocesses getconf to get the arch, so it's not easy to
				// force the arch to x86
				expect(util.arch(true)).to.be.oneOf([ 'x86', 'x64' ]);
			} else {
				expect(util.arch(true)).to.equal('x86');
			}
		});

		it('should correct ia32 for 64-bit systems (Windows)', () => {
			process.env.AXWAY_TEST_PLATFORM = 'win32';
			process.env.AXWAY_TEST_ARCH = 'ia32';
			process.env.PROCESSOR_ARCHITEW6432 = 'AMD64';

			expect(util.arch(true)).to.equal('x64');
		});

		(process.platform === 'win32' ? it.skip : it)('should correct ia32 for 64-bit systems (Linux)', () => {
			process.env.AXWAY_TEST_PLATFORM = 'linux';
			process.env.AXWAY_TEST_ARCH = 'ia32';

			expect(util.arch(true)).to.equal('x64');
		});
	});

	describe('arrayify()', () => {
		it('should convert a string to an array', () => {
			expect(util.arrayify('foo')).to.deep.equal([ 'foo' ]);
		});

		it('should convert a number to an array', () => {
			expect(util.arrayify(123)).to.deep.equal([ 123 ]);
		});

		it('should convert a set to an array', () => {
			expect(util.arrayify(new Set([ 'a', 'b' ]))).to.deep.equal([ 'a', 'b' ]);
		});

		it('should return the original array', () => {
			expect(util.arrayify([ 'foo', 'bar' ])).to.deep.equal([ 'foo', 'bar' ]);
		});

		it('should return empty array', () => {
			expect(util.arrayify('', true)).to.deep.equal([]);
		});

		it('should remove falsey items', () => {
			expect(util.arrayify([ 'a', '', 'b', null, 'c', undefined, 'd', true, false, 0, NaN, 1 ], true)).to.deep.equal([ 'a', 'b', 'c', 'd', true, 0, 1 ]);
		});
	});

	describe('assertNodeEngineVersion()', () => {
		afterEach(() => {
			delete process.env.AXWAY_TEST_NODE_VERSION;
		});

		it('should error if pkgJson is not a file or object', () => {
			expect(() => {
				util.assertNodeEngineVersion();
			}).to.throw(TypeError, 'Expected pkgJson to be an object or string to a package.json file');
			expect(() => {
				util.assertNodeEngineVersion(null);
			}).to.throw(TypeError, 'Expected pkgJson to be an object or string to a package.json file');
			expect(() => {
				util.assertNodeEngineVersion([ 'a' ]);
			}).to.throw(TypeError, 'Expected pkgJson to be an object or string to a package.json file');
			expect(() => {
				util.assertNodeEngineVersion(123);
			}).to.throw(TypeError, 'Expected pkgJson to be an object or string to a package.json file');
		});

		it('should error if package.json file does not exist', () => {
			expect(() => {
				util.assertNodeEngineVersion('foo');
			}).to.throw(Error, 'File does not exist: foo');
		});

		it('should load package.json', () => {
			expect(util.assertNodeEngineVersion(path.join(__dirname, 'fixtures', 'empty-package.json'))).to.be.true;
		});

		it('should error with bad package.json', () => {
			expect(() => {
				util.assertNodeEngineVersion(path.join(__dirname, 'fixtures', 'bad-package.json'));
			}).to.throw(Error, /^Unable to parse package.json: /);
		});

		it('should succeed without engines definition', () => {
			expect(util.assertNodeEngineVersion({})).to.be.true;
		});

		it('should success if node version is valid', () => {
			process.env.AXWAY_TEST_NODE_VERSION = 'v6.9.4';
			expect(util.assertNodeEngineVersion({ engines: { node: '6.9.4' } })).to.be.true;
			expect(util.assertNodeEngineVersion({ engines: { node: 'v6.9.4' } })).to.be.true;
			expect(util.assertNodeEngineVersion(path.join(__dirname, 'fixtures', 'good-package.json'))).to.be.true;
		});

		it('should fail if node version is not valid', () => {
			process.env.AXWAY_TEST_NODE_VERSION = 'v6.9.4';
			expect(() => {
				util.assertNodeEngineVersion({ engines: { node: '>=6.9' } });
			}).to.throw(Error, 'Invalid Node engine version in package.json: >=6.9');
			expect(() => {
				util.assertNodeEngineVersion({ engines: { node: '6.9.3' } });
			}).to.throw(Error, 'Requires Node.js \'6.9.3\', but the current version is \'v6.9.4\'');
			expect(() => {
				util.assertNodeEngineVersion({ engines: { node: '7.0.0' } });
			}).to.throw(Error, 'Requires Node.js \'7.0.0\', but the current version is \'v6.9.4\'');
		});
	});

	describe('cache()', () => {
		it('should error if namespace is not a string', async () => {
			try {
				await util.cache();
			} catch (e) {
				expect(e).to.be.instanceof(TypeError);
				expect(e.message).to.equal('Expected name to be a non-empty string');
				return;
			}

			throw new Error('Expected rejection');
		});

		it('should error if callback is not a function', async () => {
			try {
				await util.cache('foo', 'bar');
			} catch (e) {
				expect(e).to.be.instanceof(TypeError);
				expect(e.message).to.equal('Expected callback to be a function');
				return;
			}

			throw new Error('Expected rejection');
		});

		it('should cache a value', async () => {
			let counter = 0;
			const obj = { foo: 'bar' };
			const obj2 = { baz: 'pow' };

			const value = await util.cache('foo', () => {
				counter++;
				return obj;
			});
			expect(counter).to.equal(1);
			expect(value).to.be.an('object');
			expect(value).to.deep.equal(obj);

			const value2 = await util.cache('foo', () => {
				counter++;
				return obj2;
			});
			expect(counter).to.equal(1);
			expect(value2).to.be.an('object');
			expect(value2).to.deep.equal(obj);

			const value3 = await util.cache('foo', true, () => {
				counter++;
				return obj2;
			});
			expect(counter).to.equal(2);
			expect(value3).to.be.an('object');
			expect(value3).to.deep.equal(obj2);
		});

		it('should queue multiple calls', async () => {
			let counter = 0;
			const obj = { foo: 'bar' };
			const obj2 = { baz: 'pow' };

			const results = await Promise.all([
				util.cache('foo', true, async () => {
					await util.sleep(250);
					counter++;
					return obj;
				}),
				util.cache('foo', true, async () => {
					counter++;
					return obj2;
				})
			]);

			expect(counter).to.equal(1);
			expect(results).to.deep.equal([ obj, obj ]);
		});

		it('should catch errors', async () => {
			try {
				await util.cache('foo', true, () => {
					throw new Error('oh snap');
				});
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('oh snap');
				return;
			}

			throw new Error('Expected rejection');
		});
	});

	describe('cacheSync()', () => {
		it('should error if namespace is not a string', () => {
			expect(() => {
				util.cacheSync();
			}).to.throw(TypeError, 'Expected name to be a non-empty string');
		});

		it('should error if callback is not a function', () => {
			expect(() => {
				util.cacheSync('foo2', 'bar');
			}).to.throw(TypeError, 'Expected callback to be a function');
		});

		it('should cache a value', () => {
			let counter = 0;
			const obj = { foo: 'bar' };
			const obj2 = { baz: 'pow' };

			const value = util.cacheSync('foo2', () => {
				counter++;
				return obj;
			});
			expect(counter).to.equal(1);
			expect(value).to.be.an('object');
			expect(value).to.deep.equal(obj);

			const value2 = util.cacheSync('foo2', () => {
				counter++;
				return obj2;
			});
			expect(counter).to.equal(1);
			expect(value2).to.be.an('object');
			expect(value2).to.deep.equal(obj);

			const value3 = util.cacheSync('foo2', true, () => {
				counter++;
				return obj2;
			});
			expect(counter).to.equal(2);
			expect(value3).to.be.an('object');
			expect(value3).to.deep.equal(obj2);
		});

		it('should passthrough errors', () => {
			expect(() => {
				util.cacheSync('foo3', true, () => {
					throw new Error('oh snap');
				});
			}).to.throw(Error, 'oh snap');
		});
	});

	describe('debounce()', () => {
		it('should debounce multiple calls using default timeout', function (done) {
			this.slow(2000);

			let count = 0;
			const fn = util.debounce(() => {
				count++;
			});

			fn();
			fn();
			fn();

			setTimeout(() => {
				try {
					expect(count).to.equal(0);

					fn();

					setTimeout(() => {
						try {
							expect(count).to.equal(1);
							done();
						} catch (e) {
							done(e);
						}
					}, 500);
				} catch (e) {
					done(e);
				}
			}, 0);
		});

		it('should debounce multiple calls using 250ms timeout', function (done) {
			this.slow(2000);

			let count = 0;
			const fn = util.debounce(() => {
				count++;
			}, 250);

			fn();
			fn();
			fn();

			setTimeout(() => {
				try {
					expect(count).to.equal(0);

					fn();

					setTimeout(() => {
						try {
							expect(count).to.equal(1);
							done();
						} catch (e) {
							done(e);
						}
					}, 500);
				} catch (e) {
					done(e);
				}
			}, 0);
		});

		it('should resolve a promise when bouncing has stopped', async function () {
			this.slow(2000);

			let count = 0;
			const fn = util.debounce(() => {
				count++;
			});

			return Promise
				.all([
					fn(),
					fn(),
					fn(),
					fn(),
					fn(),
					fn(),
					fn()
				])
				.then(() => {
					expect(count).to.equal(1);
				});
		});

		it('should cancel a pending debounce', function (done) {
			this.slow(5000);
			this.timeout(5000);

			let count = 0;
			const fn = util.debounce(() => {
				count++;
			}, 1000);

			fn();

			setTimeout(() => {
				fn.cancel();
				setTimeout(() => {
					try {
						expect(count).to.equal(0);
						done();
					} catch (e) {
						done(e);
					}
				}, 1000);
			}, 500);
		});
	});

	describe('decodeOctalUTF8()', () => {
		it('decodes non-octal string', () => {
			expect(util.decodeOctalUTF8('titanium rocks')).to.equal('titanium rocks');
		});

		it('decodes octal string', () => {
			expect(util.decodeOctalUTF8('testing \\303\\274 and \\351\\252\\236')).to.equal('testing ü and 骞');
		});

		it('try to decode incomplete octal string', () => {
			expect(util.decodeOctalUTF8('testing \\')).to.equal('testing \0');
		});
	});

	describe('formatNumber()', () => {
		it('should format a small integer', () => {
			expect(util.formatNumber(12)).to.equal('12');
		});

		it('should format a big integer', () => {
			expect(util.formatNumber(1234567890)).to.equal('1,234,567,890');
		});

		it('should format a small float', () => {
			expect(util.formatNumber(1.2)).to.equal('1.2');
		});

		it('should format a big float', () => {
			expect(util.formatNumber(1234567890.123)).to.equal('1,234,567,890.123');
		});
	});

	describe('getActiveHandles()', () => {
		it('should return the active handles', done => {
			const handles = util.getActiveHandles();
			expect(handles).to.be.an.instanceof(Object);
			done();
		});
	});

	describe('inherits()', () => {
		it('should detect when a class extends another class', () => {
			class Foo {}
			class Bar extends Foo {}
			expect(util.inherits(Bar, Foo)).to.be.true;
		});

		it('should detect when a class does not extend another class', () => {
			class Foo {}
			class Bar extends Foo {}
			class Wiz {}
			expect(util.inherits(Bar, Wiz)).to.be.false;
		});

		it('should detect when a class deeply extends another class', () => {
			class Foo {}
			class Bar extends Foo {}
			class Baz extends Bar {}
			expect(util.inherits(Baz, Foo)).to.be.true;
		});

		it('should detect when a class extends null', () => {
			class Foo extends null {}
			expect(util.inherits(Foo, null)).to.be.true;
		});

		it('should fail if subject is not a function', () => {
			expect(() => {
				util.inherits();
			}).to.throw(TypeError, 'Expected subject to be a function object');

			expect(() => {
				util.inherits(null);
			}).to.throw(TypeError, 'Expected subject to be a function object');

			expect(() => {
				util.inherits({});
			}).to.throw(TypeError, 'Expected subject to be a function object');
		});

		it('should fail if base class is not a function', () => {
			expect(() => {
				util.inherits(function () {});
			}).to.throw(TypeError, 'Expected base class to be a function object');

			expect(() => {
				util.inherits(function () {}, '');
			}).to.throw(TypeError, 'Expected base class to be a function object');

			expect(() => {
				util.inherits(function () {}, {});
			}).to.throw(TypeError, 'Expected base class to be a function object');
		});
	});

	describe('makeSerializable()', () => {
		it('should pass through non-objects', () => {
			expect(util.makeSerializable()).to.equal(undefined);
			expect(util.makeSerializable(undefined)).to.equal(undefined);
			expect(util.makeSerializable(null)).to.equal(null);
			expect(util.makeSerializable(123)).to.equal(123);
			expect(util.makeSerializable('foo')).to.equal('foo');
			expect(util.makeSerializable(true)).to.equal(true);
			expect(util.makeSerializable(false)).to.equal(false);
			const dt = new Date();
			expect(util.makeSerializable(dt)).to.equal(dt);
		});

		it('should handle NaN', () => {
			expect(util.makeSerializable(NaN)).to.equal(null);
		});

		it('should remove non-serializable values', () => {
			expect(util.makeSerializable({
				a: () => {},
				b: Symbol()
			})).to.deep.equal({
				a: undefined,
				b: undefined
			});
		});

		it('should remove circular references', () => {
			const obj = {};
			obj.a = obj;
			obj.b = [ obj ];
			expect(util.makeSerializable(obj)).to.deep.equal({
				a: undefined,
				b: [ undefined ]
			});

			const a = { foo: 'bar' };
			const b = { baz: 'wiz', a };
			a.b = b;
			expect(util.makeSerializable({ a, b })).to.deep.equal({
				a: { foo: 'bar', b: { baz: 'wiz', a: undefined } },
				b: { baz: 'wiz', a: { foo: 'bar', b: undefined } }
			});
		});

		it('should not remove non-ciruclar references', () => {
			const obj = {};
			const meta = { msg: 'hi' };
			obj.a = meta;
			obj.b = meta;
			expect(util.makeSerializable(obj)).to.deep.equal({
				a: { msg: 'hi' },
				b: { msg: 'hi' }
			});
		});
	});

	describe('mergeDeep()', () => {
		it('should merge two objects together', () => {
			const obj = util.mergeDeep({ a: 1 }, { b: 2 });
			expect(obj).to.deep.equal({ a: 1, b: 2 });
		});

		it('should create a dest object', () => {
			const obj = util.mergeDeep(null, { b: 2 });
			expect(obj).to.deep.equal({ b: 2 });
		});

		it('should return original dest object if source not an object', () => {
			const orig = { b: 2 };
			const obj = util.mergeDeep(orig);
			expect(obj).to.equal(orig);

			const obj2 = util.mergeDeep(orig, 'foo');
			expect(obj2).to.equal(orig);
		});

		it('should merge deeply nested properties', () => {
			const fn = () => {};

			const obj = util.mergeDeep(
				{
					a: 1,
					d: null,
					g: [],
					h: [ 'a' ],
					i: { j: {} }
				},
				{
					a: 2,
					b: 3,
					c: [ 'x', 'y', 'z' ],
					d: { fn: fn },
					e: undefined,
					f: null,
					g: { foo: 'bar' },
					h: [ 'b', 'c' ],
					i: { j: { k: 'l' } }
				}
			);

			expect(obj).to.deep.equal({
				a: 2,
				b: 3,
				c: [ 'x', 'y', 'z' ],
				d: { fn: fn },
				f: null,
				g: { foo: 'bar' },
				h: [ 'a', 'b', 'c' ],
				i: { j: { k: 'l' } }
			});
		});
	});

	describe('mutex()', () => {
		it('should error if name is not a string', async () => {
			try {
				await util.mutex();
			} catch (err) {
				expect(err).to.be.an.instanceof(TypeError);
				expect(err.message).to.equal('Expected name to be a non-empty string');
				return;
			}

			throw new Error('Expected rejection');
		});

		it('should error if callback is not a function', async () => {
			try {
				await util.mutex('foo', 'bar');
			} catch (err) {
				expect(err).to.be.an.instanceof(TypeError);
				expect(err.message).to.equal('Expected callback to be a function');
				return;
			}

			throw new Error('Expected rejection');
		});

		it('should queue up multiple calls', async () => {
			let count = 0;

			const fn = () => {
				return util.mutex('foo', () => {
					return ++count;
				});
			};

			const results = await Promise.all([ fn(), fn(), fn() ]);
			expect(count).to.equal(3);
			expect(results).to.have.lengthOf(3);
			expect(results[1]).to.not.equal(results[0]);
			expect(results[2]).to.not.equal(results[0]);
		});

		it('should queue up multiple async calls', async () => {
			let count = 0;

			const fn = () => {
				return util.mutex('foo', () => {
					return new Promise(resolve => setTimeout(() => {
						resolve(++count);
					}, 100));
				});
			};

			const results = await Promise.all([ fn(), fn(), fn() ]);
			expect(count).to.equal(3);
			expect(results).to.have.lengthOf(3);
			expect(results[1]).to.equal(results[0] + 1);
			expect(results[2]).to.equal(results[0] + 2);
		});

		it('should catch errors', async () => {
			try {
				await util.mutex('foo', () => {
					throw new Error('oh snap');
				});
			} catch (err) {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal('oh snap');
				return;
			}

			throw new Error('Expected error to be caught');
		});
	});

	describe('osInfo()', () => {
		it('should get the os info', () => {
			const info = util.osInfo();
			expect(info).to.have.keys('name', 'version');
		});
	});

	describe('randomBytes()', () => {
		it('should return 0 random bytes', () => {
			const r = util.randomBytes(0);
			expect(r).to.be.a('string');
			expect(r).to.have.lengthOf(0);
		});

		it('should return 1 random byte', () => {
			const r = util.randomBytes(1);
			expect(r).to.be.a('string');
			expect(r).to.have.lengthOf(2);
		});

		it('should return 2 random bytes', () => {
			const r = util.randomBytes(2);
			expect(r).to.be.a('string');
			expect(r).to.have.lengthOf(4);
		});

		it('should return 20 random bytes', () => {
			const r = util.randomBytes(20);
			expect(r).to.be.a('string');
			expect(r).to.have.lengthOf(40);
		});
	});

	describe('redact()', () => {
		it('should error if options are invalid', () => {
			expect(() => {
				util.redact({}, 'foo');
			}).to.throw(TypeError, 'Expected options to be an object');

			expect(() => {
				util.redact({}, 123);
			}).to.throw(TypeError, 'Expected options to be an object');
		});

		it('should error if props is invalid', () => {
			expect(() => {
				util.redact({}, { props: 'foo' });
			}).to.throw(TypeError, 'Expected props to be a set or array of strings');

			expect(() => {
				util.redact({}, { props: 123 });
			}).to.throw(TypeError, 'Expected props to be a set or array of strings');

			expect(() => {
				util.redact({}, { props: [ 123 ] });
			}).to.throw(TypeError, 'Expected props to be a set or array of strings');

			expect(() => {
				util.redact({}, { props: [ {} ] });
			}).to.throw(TypeError, 'Expected props to be a set or array of strings');

			expect(() => {
				util.redact({}, { props: new Set([ 123 ]) });
			}).to.throw(TypeError, 'Expected props to be a set or array of strings');

			expect(() => {
				util.redact({}, { props: new Set([ {} ]) });
			}).to.throw(TypeError, 'Expected props to be a set or array of strings');
		});

		it('should error if replacements is invalid', () => {
			expect(() => {
				util.redact({}, { replacements: 'foo' });
			}).to.throw(TypeError, 'Expected replacements to be an array of replace arguments');

			expect(() => {
				util.redact({}, { replacements: [ 123 ] });
			}).to.throw(TypeError, 'Expected replacements to be an array of replace arguments');
		});

		it('should redact undefined value', () => {
			expect(util.redact()).to.equal(undefined);
		});

		it('should redact null value', () => {
			expect(util.redact(null)).to.equal(null);
		});

		it('should redact a string by trigger word', () => {
			expect(util.redact('my password is 123456')).to.equal('<REDACTED>');
		});

		it('should passthrough non-string and non-object based values', () => {
			expect(util.redact(true)).to.equal(true);
			expect(util.redact(false)).to.equal(false);

			expect(util.redact(123)).to.equal(123);

			expect(isNaN(util.redact(NaN))).to.equal(true);

			const fn = () => {};
			expect(util.redact(fn)).to.equal(fn);
		});

		it('should redact a property (mutable)', () => {
			const obj = {
				good: 'hi',
				bad: 'go away',
				superbad: 'whoo'
			};
			expect(util.redact(obj, { props: [ 'bad', /^super/ ] })).to.deep.equal({
				good: 'hi',
				bad: '<REDACTED>',
				superbad: '<REDACTED>'
			});
			expect(obj.good).to.equal('hi');
			expect(obj.bad).to.equal('<REDACTED>');
			expect(obj.superbad).to.equal('<REDACTED>');
		});

		it('should redact a property (immutable)', () => {
			const obj = {
				good: 'hi',
				bad: 'go away',
				superbad: 'whoo'
			};
			expect(util.redact(obj, { clone: true, props: [ 'bad', /^super/ ] })).to.deep.equal({
				good: 'hi',
				bad: '<REDACTED>',
				superbad: '<REDACTED>'
			});
			expect(obj.good).to.equal('hi');
			expect(obj.bad).to.equal('go away');
			expect(obj.superbad).to.equal('whoo');
		});

		it('should redact part of a string', () => {
			expect(util.redact(`${process.env.HOME}/foo/bar`)).to.equal('<HOME>/foo/bar');
			expect(util.redact(`Hello! My name is ${process.platform === 'win32' ? process.env.USERNAME : process.env.USER}`)).to.equal('Hello! My name is <REDACTED>');
		});

		it('should replace a sensitive data in a string', () => {
			expect(util.redact('Your username is chris!', {
				replacements: [
					[ 'chris', '*****' ]
				]
			})).to.equal('Your username is *****!');

			expect(util.redact('Account name: foo@bar.com')).to.equal('Account name: <REDACTED>');

			expect(util.redact('Call me at 1-800-555-1212', {
				replacements: [
					[ /\d-\d{3}-\d{3}-\d{4}/ ]
				]
			})).to.equal('Call me at <REDACTED>');

			const s = 'TODO:\n1. Draw winner\n2. Email foo@bar.com\n3. Ship prize';
			expect(util.redact(s)).to.equal('TODO:\n1. Draw winner\n2. Email <REDACTED>\n3. Ship prize');
		});

		it('should redact an array of items', () => {
			const name = process.env.USERNAME || process.env.USER;
			const arr = util.redact([
				{ user: name, password: '123456', email: 'foo@bar.com' },
				`Welcome ${name.substring(0, 1).toUpperCase()}${name.substring(1).toLowerCase()}!`,
				123,
				[ `${process.env.HOME}/foo/bar` ]
			]);

			expect(arr).to.deep.equal([
				{ user: '<REDACTED>', password: '<REDACTED>', email: '<REDACTED>' },
				'Welcome <REDACTED>!',
				123,
				[ '<HOME>/foo/bar' ]
			]);
		});
	});

	describe('sha1()', () => {
		it('should hash a buffer', () => {
			expect(util.sha1(Buffer.from('foo'))).to.equal('0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33');
		});

		it('should hash a string', () => {
			expect(util.sha1('foo')).to.equal('0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33');
		});

		it('should hash a number', () => {
			expect(util.sha1(123)).to.equal('40bd001563085fc35165329ea1ff5c5ecbdbbeef');
		});

		it('should hash an object', () => {
			expect(util.sha1({ foo: 'bar' })).to.equal('a5e744d0164540d33b1d7ea616c28f2fa97e754a');
		});
	});

	describe('sleep', () => {
		it('should wait 1 second', async function () {
			this.slow(3000);
			this.timeout(3000);

			const start = Date.now();
			await util.sleep(1000);
			expect(Date.now() - start).to.be.at.least(1000);
		});

		it('should error if ms is not a number', async () => {
			try {
				await util.sleep('foo');
			} catch (err) {
				expect(err).to.be.instanceof(TypeError);
				expect(err.message).to.equal('Expected timeout milliseconds to be a number');
				return;
			}

			throw new Error('Expected type error');
		});

		it('should error if ms is less than zero', async () => {
			try {
				await util.sleep(-666);
			} catch (err) {
				expect(err).to.be.instanceof(RangeError);
				expect(err.message).to.equal('Expected timeout milliseconds to be greater than or equal to zero');
				return;
			}

			throw new Error('Expected range error');
		});
	});

	describe('tailgate()', () => {
		it('should error if name is not a string', async () => {
			try {
				await util.tailgate();
			} catch (err) {
				expect(err).to.be.an.instanceof(TypeError);
				expect(err.message).to.equal('Expected name to be a non-empty string');
				return;
			}

			throw new Error('Expected rejection');
		});

		it('should error if callback is not a function', async () => {
			try {
				await util.tailgate('foo', 'bar');
			} catch (err) {
				expect(err).to.be.an.instanceof(TypeError);
				expect(err.message).to.equal('Expected callback to be a function');
				return;
			}

			throw new Error('Expected rejection');
		});

		it('should queue up multiple calls', async () => {
			let count = 0;
			const fn = () => util.tailgate('foo', () => ++count);
			const results = await Promise.all([ fn(), fn(), fn() ]);

			expect(count).to.equal(3);
			expect(results).to.have.lengthOf(3);
			expect(results[1]).to.equal(results[0] + 1);
			expect(results[2]).to.equal(results[0] + 2);
		});

		it('should queue up multiple async calls', async () => {
			let count = 0;
			const fn = () => util.tailgate('foo', () => new Promise(resolve => resolve(++count)));
			const results = await Promise.all([ fn(), fn(), fn() ]);

			expect(count).to.equal(1);
			expect(results).to.have.lengthOf(3);
			expect(results[1]).to.equal(results[0]);
			expect(results[2]).to.equal(results[0]);
		});

		it('should catch errors', async () => {
			try {
				await util.tailgate('foo', () => {
					throw new Error('oh snap');
				});
			} catch (err) {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal('oh snap');
				return;
			}

			throw new Error('Expected error to be caught');
		});
	});

	describe('trackTimers()', () => {
		it('should track there were no timers', () => {
			const timers = [];
			try {
				const stop = util.trackTimers();
				const activeTimers = stop();
				expect(activeTimers).to.have.lengthOf(timers.length);
			} finally {
				timers.forEach(clearTimeout);
			}
		});

		it('should track a single setTimeout()', () => {
			const timers = [];
			try {
				const stop = util.trackTimers();
				timers.push(setTimeout(() => {}, 1e7));
				const activeTimers = stop();
				expect(activeTimers).to.have.lengthOf(timers.length);
			} finally {
				timers.forEach(a => clearTimeout(a));
			}
		});

		it('should track a multiple setTimeout()\'s', () => {
			const timers = [];
			try {
				const stop = util.trackTimers();
				timers.push(setTimeout(() => {}, 1e7));
				const activeTimers = stop();
				expect(activeTimers).to.have.lengthOf(timers.length);
			} finally {
				timers.forEach(clearTimeout);
			}
		});
	});

	describe('unique()', () => {
		it('should return an empty array if input is not an array', () => {
			let r = util.unique();
			expect(r).to.be.an('array');
			expect(r).to.have.lengthOf(0);

			r = util.unique('foo');
			expect(r).to.be.an('array');
			expect(r).to.have.lengthOf(0);

			r = util.unique([]);
			expect(r).to.be.an('array');
			expect(r).to.have.lengthOf(0);
		});

		it('should handle a string and undefined', () => {
			const r = util.unique([ 'foo', undefined ]);
			expect(r).to.be.an('array');
			expect(r).to.deep.equal([ 'foo' ]);
		});

		it('should handle an empty string', () => {
			const r = util.unique([ 'foo', '', 'bar', '' ]);
			expect(r).to.be.an('array');
			expect(r).to.deep.equal([ 'foo', '', 'bar' ]);
		});

		it('should remove duplicates, null, and undefined elements', () => {
			const r = util.unique([ 'a', 1, 'b', 'c', 2, 'a', undefined, 'd', 3, 'b', null, 'b', 1, 3 ]);
			expect(r).to.be.an('array');
			expect(r).to.deep.equal([ 'a', 1, 'b', 'c', 2, 'd', 3 ]);
		});
	});
});
