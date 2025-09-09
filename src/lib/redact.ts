import { homedir } from 'os';

/**
 * A lookup of various properties that must be redacted during log message serialization.
 * @type {Array.<String|RegExp>}
 */
const mandatoryRedactedProps = [
	/clientsecret/i,
	/password/i
];

/**
 * A list of regexes that will trigger the entire string to be redacted.
 * @type {Array.<String|RegExp>}
 */
const mandatoryRedactionTriggers = [
	/password/i
];

/**
 * A list of string replacement arguments.
 * @type {Array.<Array|String>}
 */
const mandatoryReplacements = [
	[ homedir(), '<HOME>' ],
	process.env.USER, // macOS, Linux
	process.env.USERNAME, // Windows
	/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g // email address
];

/**
 * Scrubs any potentially sensitive data from a value. By default, if the source is an object, it
 * will be mutated. Redacted properties or elements will not be removed.
 *
 * @param {*} data - The source object to copy from.
 * @param {Object} [opts] - Various options.
 * @param {Boolean} [opts.clone] - When `true`, objects and arrays are cloned instead of mutated.
 * @param {Array|Set} [opts.props] - A list of properties to redact.
 * @param {String} [opts.redacted="<REDACTED>"] - The string to replace redacted words with.
 * @param {Array|Set} [opts.replacements] - A list of replacement criteria and an optional value.
 * @param {Array|Set} [opts.triggers] - A list of keywords that cause an entire string to be
 * redacted.
 * @returns {*}
 *
 * @example
 * > redact('foo')
 * 'foo'
 *
 * @example
 * > redact('my password is 123456')
 * '<REDACTED>'
 *
 * @example
 * > redact({
 *     info: {
 *         username: 'chris',
 *         password: '123456',
 *         desktop: '/Users/chris/Desktop'
 *     }
 * })
 * {
 *     info: {
 *         username: '<REDACTED>', // matches process.env.USER
 *         password: '<REDACTED>', // matches blocked property
 *         desktop: '~/Desktop'    // matches process.env.HOME
 *     }
 * }
 */
export function redact(data, opts:any = {}) {
	if (!opts || typeof opts !== 'object') {
		throw new TypeError('Expected options to be an object');
	}

	const redacted = opts.redacted || '<REDACTED>';

	const init = (key, value) => {
		if (Array.isArray(opts[key]) || opts[key] instanceof Set) {
			for (const item of opts[key]) {
				if (item && typeof item === 'string') {
					value.push(new Function('s', `return s === ${JSON.stringify(item.toLowerCase())}`));
				} else if (item instanceof RegExp) {
					value.push(item.test.bind(item));
				} else {
					throw new TypeError(`Expected ${key} to be a set or array of strings or regexes`);
				}
			}
		} else if (opts[key]) {
			throw new TypeError(`Expected ${key} to be a set or array of strings or regexes`);
		}
		return value;
	};

	const props = init('props', mandatoryRedactedProps.map(re => re.test.bind(re)));
	const triggers = init('triggers', mandatoryRedactionTriggers.map(re => re.test.bind(re)));

	// init the replacements
	const replacementMap = new Map();
	const addReplacement = replacements => {
		if (Array.isArray(replacements) || replacements instanceof Set) {
			for (const replacement of replacements) {
				let pattern, value;
				if (!replacement) {
					continue;
				} else if (Array.isArray(replacement)) {
					([ pattern, value ] = replacement);
				} else if (replacement && (typeof replacement === 'string' || replacement instanceof RegExp)) {
					pattern = replacement;
				} else {
					throw new TypeError('Expected replacements to be an array of replace arguments');
				}
				const key = pattern;
				if (!(pattern instanceof RegExp)) {
					// eslint-disable-next-line security/detect-non-literal-regexp
					pattern = new RegExp(pattern.replace(/\\/g, '\\\\'), 'ig');
				}
				if (value === undefined || value === null) {
					value = redacted;
				}
				replacementMap.set(key, s => s.replace(pattern, value));
			}
		} else if (replacements) {
			throw new TypeError('Expected replacements to be an array of replace arguments');
		}
	};
	addReplacement(mandatoryReplacements);
	addReplacement(opts.replacements);
	const replacements = Array.from(replacementMap.values());

	// recursively walk the value and return the result
	return (function scrub(src) {
		let dest = src;
		if (Array.isArray(src)) {
			dest = opts.clone ? [] : src;
			for (let i = 0, len = src.length; i < len; i++) {
				dest[i] = scrub(src[i]);
			}
		} else if (src && typeof src === 'object') {
			dest = opts.clone ? {} : src;
			for (const [ key, value ] of Object.entries(src)) {
				let match = false;
				for (const test of props) {
					if (match = test(key)) {
						dest[key] = redacted;
						break;
					}
				}
				// if we found a match, then we just redacted the whole string and there's no need
				// to scrub it
				if (!match) {
					dest[key] = scrub(value);
				}
			}
		} else if (src && typeof src === 'string') {
			for (const replace of replacements) {
				dest = replace(dest);
				if (dest === redacted) {
					break;
				}
			}
			for (const test of triggers) {
				if (test(dest)) {
					dest = redacted;
					break;
				}
			}
		}
		return dest;
	}(data));
}
