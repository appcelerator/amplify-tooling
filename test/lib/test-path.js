import _path from 'path';

import * as path from '../../dist/lib/path.js';

const isWin = /^win/.test(process.platform);

describe('path', () => {
	describe('expandPath()', () => {
		beforeEach(function () {
			this.HOME = process.env.HOME;
			this.USERPROFILE = process.env.USERPROFILE;
			this.SystemRoot = process.env.SystemRoot;
		});

		afterEach(function () {
			this.HOME && (process.env.HOME = this.HOME);
			this.USERPROFILE && (process.env.USERPROFILE = this.USERPROFILE);
			this.SystemRoot && (process.env.SystemRoot = this.SystemRoot);
			delete process.env.AXWAY_TEST_PLATFORM;
		});

		it('should resolve the home directory using HOME', () => {
			process.env.HOME = isWin ? 'C:\\Users\\username' : '/Users/username';
			delete process.env.USERPROFILE;

			const p = path.expandPath('~/foo');
			expect(p).to.equal(isWin ? 'C:\\Users\\username\\foo' : '/Users/username/foo');
		});

		it('should resolve the home directory using USERPROFILE', () => {
			delete process.env.HOME;
			process.env.USERPROFILE = isWin ? 'C:\\Users\\username' : '/Users/username';

			const p = path.expandPath('~/foo');
			expect(p).to.equal(isWin ? 'C:\\Users\\username\\foo' : '/Users/username/foo');
		});

		it('should collapse relative segments', () => {
			const p = path.expandPath('/path/./to/../foo');
			expect(p).to.match(isWin ? /^\w:\\path\\foo$/ : /^\/path\/foo$/);
		});

		it('should resolve environment paths (Windows)', () => {
			process.env.AXWAY_TEST_PLATFORM = 'win32';
			process.env.SystemRoot = 'C:\\WINDOWS';
			const p = path.expandPath('%SystemRoot%\\foo');
			expect(isWin ? p : p.substring(process.cwd().length + 1)).to.equal('C:\\WINDOWS\\foo');
		});
	});
});
