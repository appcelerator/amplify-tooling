/* eslint-disable node/no-deprecated-api, no-new-func */

import * as crypto from 'crypto';
import * as fs from 'fs';
import get from 'lodash.get';
import set from 'lodash.set';

import { execSync, spawnSync } from 'child_process';
import { homedir } from 'os';
import { isFile } from './fs.js';

let archCache: string | null = null;

/**
 * Returns the current machine's architecture. Possible values are `x64` for 64-bit and `x86` for
 * 32-bit (i386/ia32) systems.
 *
 * @param {Boolean} bypassCache=false - When true, re-detects the system architecture, though it
 * will never change.
 * @returns {String}
 */
export function arch(bypassCache = false) : string {
	if (archCache && !bypassCache) {
		return archCache;
	}

	// we cache the architecture since it never changes
	const platform = process.env.AXWAY_TEST_PLATFORM || process.platform;
	archCache = process.env.AXWAY_TEST_ARCH || process.arch;

	if (archCache === 'ia32') {
		if ((platform === 'win32' && process.env.PROCESSOR_ARCHITEW6432)
			|| (platform === 'linux' && /64/.test(execSync('getconf LONG_BIT', { encoding: 'utf8' })))) {
			// it's actually 64-bit
			archCache = 'x64';
		} else {
			archCache = 'x86';
		}
	}

	return archCache;
}

/**
 * Re-export of lodash's `get()` function.
 *
 * For more information, visit {@link https://www.npmjs.com/package/lodash.get} or
 * {@link https://lodash.com/docs/4.17.15#get}.
 *
 * @param {Object} obj - The object to query.
 * @param {Array.<String>|String} [path] - The path of the property to get.
 * @param {*} [defaultValue] - The value returned for `undefined` resolved values.
 * @returns {*}
 */
export { get };

/**
 * Deeply merges two JavaScript objects.
 *
 * @param {Object} dest - The object to copy the source into.
 * @param {Object} src - The object to copy.
 * @returns {Object} Returns the dest object.
 */
export function mergeDeep(dest: { [key: string]: any }, src: { [key: string]: any }) : object {
	if (typeof dest !== 'object' || dest === null || Array.isArray(dest)) {
		dest = {};
	}

	if (typeof src !== 'object' || src === null || Array.isArray(src)) {
		return dest;
	}

	for (const key of Object.keys(src)) {
		const value = src[key];
		if (Array.isArray(value)) {
			if (Array.isArray(dest[key])) {
				dest[key].push(...value);
			} else {
				dest[key] = value.slice(); // clone the original array
			}
		} else if (typeof value === 'object' && value !== null) {
			if (typeof dest[key] !== 'object' || dest[key] === null || Array.isArray(dest[key])) {
				dest[key] = {};
			}
			mergeDeep(dest[key], value);
		} else if (typeof value !== 'undefined') {
			dest[key] = value;
		}
	}

	return dest;
}

/**
 * Tries to resolve the operating system name and version.
 *
 * @returns {Object}
 */
export function osInfo(): object {
	let name = null;
	let version = null;

	switch (process.platform) {
		case 'darwin':
			{
				const stdout = spawnSync('sw_vers').stdout.toString();
				let m = stdout.match(/ProductName:\s+(.+)/i);
				if (m) {
					name = m[1];
				}
				m = stdout.match(/ProductVersion:\s+(.+)/i);
				if (m) {
					version = m[1];
				}
			}
			break;

		case 'linux':
			name = 'GNU/Linux';

			if (isFile('/etc/lsb-release')) {
				const contents = fs.readFileSync('/etc/lsb-release', 'utf8');
				let m = contents.match(/DISTRIB_DESCRIPTION=(.+)/i);
				if (m) {
					name = m[1].replace(/"/g, '');
				}
				m = contents.match(/DISTRIB_RELEASE=(.+)/i);
				if (m) {
					version = m[1].replace(/"/g, '');
				}
			} else if (isFile('/etc/system-release')) {
				const parts = fs.readFileSync('/etc/system-release', 'utf8').split(' ');
				if (parts[0]) {
					name = parts[0];
				}
				if (parts[2]) {
					version = parts[2];
				}
			}
			break;

		case 'win32':
			{
				const stdout = spawnSync('wmic', [ 'os', 'get', 'Caption,Version' ]).stdout.toString();
				const s = stdout.split('\n')[1].split(/ {2,}/);
				if (s.length > 0) {
					name = s[0].trim() || 'Windows';
				}
				if (s.length > 1) {
					version = s[1].trim() || '';
				}
			}
			break;
	}

	return {
		name,
		version
	};
}

/**
 * Returns the specified number of random bytes as a hex string.
 *
 * @param {Number} howMany - The number of random bytes to generate. Must be greater than or equal
 * to zero.
 * @returns {String}
 */
export function randomBytes(howMany: number) : string {
	return crypto.randomBytes(Math.max(~~howMany, 0)).toString('hex');
}

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
const mandatoryReplacements: (string|RegExp|undefined|string[])[] = [
	[ homedir(), '<HOME>' ],
	process.env.USER, // macOS, Linux
	process.env.USERNAME, // Windows
	/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g // email address
];

interface RedactOptions {
	clone?: boolean;
	props?: (string|RegExp)[] | Set<string|RegExp>;
	redacted?: string;
	replacements?: (string|RegExp)[] | Set<string|RegExp>;
	triggers?: (string|RegExp)[] | Set<string|RegExp>;
	[key: string]: any;
}

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
export function redact(data: any, opts: RedactOptions = {}) : any {
	if (!opts || typeof opts !== 'object') {
		throw new TypeError('Expected options to be an object');
	}

	const redacted = opts.redacted || '<REDACTED>';

	type TestFunction = (s: string) => boolean;

	const init = (key: string, value: TestFunction[]) => {
		if (Array.isArray(opts[key]) || opts[key] instanceof Set) {
			for (const item of opts[key]) {
				if (item && typeof item === 'string') {
					value.push((s: string) => s === item.toLowerCase());
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
	type ReplacementValue = string | RegExp | undefined | string[]
	type ReplacementList = ReplacementValue[] | Set<ReplacementValue>;
	const addReplacement = (replacements: ReplacementList | undefined) => {
		if (Array.isArray(replacements) || replacements instanceof Set) {
			for (const replacement of (replacements as ReplacementList)) {
				let pattern: string | RegExp;
				let value: string | null | undefined;
				if (!replacement) {
					continue;
				} else if (Array.isArray(replacement)) {
					([ pattern, value ] = replacement);
				} else if (replacement && (typeof replacement === 'string' || replacement instanceof RegExp)) {
					pattern = replacement;
				} else {
					throw new TypeError('Expected replacements to be an array of replace arguments');
				}
				const key: string | RegExp = pattern;
				if (!(pattern instanceof RegExp)) {
					// eslint-disable-next-line security/detect-non-literal-regexp
					pattern = new RegExp(pattern.replace(/\\/g, '\\\\'), 'ig');
				}
				if (value === undefined || value === null) {
					value = redacted;
				}
				replacementMap.set(key, (s: string) => s.replace(pattern, value as string));
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

/**
 * Re-export of lodash's `set()` function.
 *
 * For more information, visit {@link https://www.npmjs.com/package/lodash.set} or
 * {@link https://lodash.com/docs/4.17.15#set}.
 *
 * @param {Object} obj - The object to modify.
 * @param {Array.<String>|String} [path] - The path of the property to set.
 * @param {*} [defaultValue] - The value to set.
 * @returns {*}
 */
export { set };
