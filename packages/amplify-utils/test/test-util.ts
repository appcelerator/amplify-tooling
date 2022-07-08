import { expect } from 'chai';
import * as util from '../src/index.js';

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

	describe('mergeDeep()', () => {
		it('should merge two objects together', () => {
			const obj = util.mergeDeep({ a: 1 }, { b: 2 });
			expect(obj).to.deep.equal({ a: 1, b: 2 });
		});

		it('should create a dest object', () => {
			const obj = util.mergeDeep(null as any, { b: 2 });
			expect(obj).to.deep.equal({ b: 2 });
		});

		it('should return original dest object if source not an object', () => {
			const orig = { b: 2 };
			const obj = util.mergeDeep(orig, undefined as any);
			expect(obj).to.equal(orig);

			const obj2 = util.mergeDeep(orig, 'foo' as any);
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
				util.redact({}, 'foo' as any);
			}).to.throw(TypeError, 'Expected options to be an object');

			expect(() => {
				util.redact({}, 123 as any);
			}).to.throw(TypeError, 'Expected options to be an object');
		});

		it('should error if props is invalid', () => {
			expect(() => {
				util.redact({}, { props: 'foo' } as any);
			}).to.throw(TypeError, 'Expected props to be a set or array of strings');

			expect(() => {
				util.redact({}, { props: 123 } as any);
			}).to.throw(TypeError, 'Expected props to be a set or array of strings');

			expect(() => {
				util.redact({}, { props: [ 123 ] } as any);
			}).to.throw(TypeError, 'Expected props to be a set or array of strings');

			expect(() => {
				util.redact({}, { props: [ {} ] } as any);
			}).to.throw(TypeError, 'Expected props to be a set or array of strings');

			expect(() => {
				util.redact({}, { props: new Set([ 123 ]) } as any);
			}).to.throw(TypeError, 'Expected props to be a set or array of strings');

			expect(() => {
				util.redact({}, { props: new Set([ {} ]) } as any);
			}).to.throw(TypeError, 'Expected props to be a set or array of strings');
		});

		it('should error if replacements is invalid', () => {
			expect(() => {
				util.redact({}, { replacements: 'foo' } as any);
			}).to.throw(TypeError, 'Expected replacements to be an array of replace arguments');

			expect(() => {
				util.redact({}, { replacements: [ 123 ] } as any);
			}).to.throw(TypeError, 'Expected replacements to be an array of replace arguments');
		});

		it('should redact undefined value', () => {
			expect(util.redact(undefined)).to.equal(undefined);
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
			} as any)).to.equal('Your username is *****!');

			expect(util.redact('Account name: foo@bar.com')).to.equal('Account name: <REDACTED>');

			expect(util.redact('Call me at 1-800-555-1212', {
				replacements: [
					[ /\d-\d{3}-\d{3}-\d{4}/ ]
				]
			} as any)).to.equal('Call me at <REDACTED>');

			const s = 'TODO:\n1. Draw winner\n2. Email foo@bar.com\n3. Ship prize';
			expect(util.redact(s)).to.equal('TODO:\n1. Draw winner\n2. Email <REDACTED>\n3. Ship prize');
		});

		it('should redact an array of items', () => {
			const name = process.env.USERNAME || process.env.USER || '';
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
});
