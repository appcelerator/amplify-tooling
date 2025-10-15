import { homedir } from 'os';
import { redact } from '../../dist/lib/redact.js';

describe('redact', () => {

	describe('redact()', () => {
		it('should error if options are invalid', () => {
			expect(() => {
				redact({}, 'foo');
			}).to.throw(TypeError, 'Expected options to be an object');

			expect(() => {
				redact({}, 123);
			}).to.throw(TypeError, 'Expected options to be an object');
		});

		it('should error if props is invalid', () => {
			expect(() => {
				redact({}, { props: 'foo' });
			}).to.throw(TypeError, 'Expected props to be a set or array of strings');

			expect(() => {
				redact({}, { props: 123 });
			}).to.throw(TypeError, 'Expected props to be a set or array of strings');

			expect(() => {
				redact({}, { props: [ 123 ] });
			}).to.throw(TypeError, 'Expected props to be a set or array of strings');

			expect(() => {
				redact({}, { props: [ {} ] });
			}).to.throw(TypeError, 'Expected props to be a set or array of strings');

			expect(() => {
				redact({}, { props: new Set([ 123 ]) });
			}).to.throw(TypeError, 'Expected props to be a set or array of strings');

			expect(() => {
				redact({}, { props: new Set([ {} ]) });
			}).to.throw(TypeError, 'Expected props to be a set or array of strings');
		});

		it('should error if replacements is invalid', () => {
			expect(() => {
				redact({}, { replacements: 'foo' });
			}).to.throw(TypeError, 'Expected replacements to be an array of replace arguments');

			expect(() => {
				redact({}, { replacements: [ 123 ] });
			}).to.throw(TypeError, 'Expected replacements to be an array of replace arguments');
		});

		it('should redact undefined value', () => {
			expect(redact()).to.equal(undefined);
		});

		it('should redact null value', () => {
			expect(redact(null)).to.equal(null);
		});

		it('should redact a string by trigger word', () => {
			expect(redact('my password is 123456')).to.equal('<REDACTED>');
		});

		it('should passthrough non-string and non-object based values', () => {
			expect(redact(true)).to.equal(true);
			expect(redact(false)).to.equal(false);

			expect(redact(123)).to.equal(123);

			expect(isNaN(redact(NaN))).to.equal(true);

			const fn = () => {};
			expect(redact(fn)).to.equal(fn);
		});

		it('should redact a property (mutable)', () => {
			const obj = {
				good: 'hi',
				bad: 'go away',
				superbad: 'whoo'
			};
			expect(redact(obj, { props: [ 'bad', /^super/ ] })).to.deep.equal({
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
			expect(redact(obj, { clone: true, props: [ 'bad', /^super/ ] })).to.deep.equal({
				good: 'hi',
				bad: '<REDACTED>',
				superbad: '<REDACTED>'
			});
			expect(obj.good).to.equal('hi');
			expect(obj.bad).to.equal('go away');
			expect(obj.superbad).to.equal('whoo');
		});

		it('should redact part of a string', () => {
			expect(redact(`${homedir()}/foo/bar`)).to.equal('<HOME>/foo/bar');
			expect(redact(`Hello! My name is ${process.platform === 'win32' ? process.env.USERNAME : process.env.USER}`)).to.equal('Hello! My name is <REDACTED>');
		});

		it('should replace a sensitive data in a string', () => {
			expect(redact('Your username is chris!', {
				replacements: [
					[ 'chris', '*****' ]
				]
			})).to.equal('Your username is *****!');

			expect(redact('Account name: foo@bar.com')).to.equal('Account name: <REDACTED>');

			expect(redact('Call me at 1-800-555-1212', {
				replacements: [
					[ /\d-\d{3}-\d{3}-\d{4}/ ]
				]
			})).to.equal('Call me at <REDACTED>');

			const s = 'TODO:\n1. Draw winner\n2. Email foo@bar.com\n3. Ship prize';
			expect(redact(s)).to.equal('TODO:\n1. Draw winner\n2. Email <REDACTED>\n3. Ship prize');
		});

		it('should redact an array of items', () => {
			const name = process.env.USERNAME || process.env.USER;
			const arr = redact([
				{ user: name, password: '123456', email: 'foo@bar.com' },
				`Welcome ${name.substring(0, 1).toUpperCase()}${name.substring(1).toLowerCase()}!`,
				123,
				[ `${homedir()}/foo/bar` ]
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
