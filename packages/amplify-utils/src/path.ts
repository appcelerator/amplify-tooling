import _path from 'path';

const homeDirRegExp = /^~([\\|/].*)?$/;
const winRegExp = /^win/;
const winEnvVarRegExp = /(%([^%]*)%)/g;

/**
 * Resolves a path into an absolute path.
 *
 * @param {...String} segments - The path segments to join and resolve.
 * @returns {String}
 */
export function expandPath(...segments: string[]) : string {
	const platform = process.env.AXWAY_TEST_PLATFORM || process.platform;
	segments[0] = segments[0].replace(homeDirRegExp, (process.env.HOME || process.env.USERPROFILE) + '$1');
	if (winRegExp.test(platform)) {
		return _path.resolve(_path.join.apply(null, segments).replace(winEnvVarRegExp, (s, m, n) => {
			return process.env[n] || m;
		}));
	}
	return _path.resolve.apply(null, segments);
}
