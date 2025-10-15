import fs from 'fs';
import path from 'path';
import tmp from 'tmp';
import { fileURLToPath } from 'url';

import { isDir, isFile, mkdirpSync, writeFileSync } from '../../dist/lib/fs.js';

const {
	name: tmpDir,
	removeCallback
} = tmp.dirSync({
	mode: '755',
	prefix: 'amplify-utils-fs-test-',
	unsafeCleanup: true
});
const __filename = fileURLToPath(import.meta.url);

describe('fs', () => {
	after(() => removeCallback());

	describe('isDir()', () => {
		it('should succeed if a directory exists', () => {
			expect(isDir(tmpDir)).to.be.true;
		});

		it('should fail if a directory does not exist', () => {
			expect(isDir(path.join(tmpDir, 'doesnotexist'))).to.be.false;
		});

		it('should fail if a directory is a file', () => {
			expect(isDir(__filename)).to.be.false;
		});
	});

	describe('isFile()', () => {
		it('should succeed if a file exists', () => {
			expect(isFile(__filename)).to.be.true;
		});

		it('should fail if a file does not exist', () => {
			expect(isFile(path.join(tmpDir, 'doesnotexist'))).to.be.false;
		});

		it('should fail if a file is a directory', () => {
			expect(isFile(tmpDir)).to.be.false;
		});
	});

	describe('mkdirpSync()', () => {
		afterEach(() => {
			fs.rmSync(tmpDir, { recursive: true });
		});

		it('should create a directory', () => {
			const p = path.join(tmpDir, 'foo', 'bar');
			expect(fs.existsSync(p)).to.equal(false);
			mkdirpSync(p);
			expect(fs.existsSync(p)).to.equal(true);
		});
	});

	describe('writeFileSync()', () => {

		it('should write a file', () => {
			const f = path.join(tmpDir, 'foo', 'bar.txt');
			writeFileSync(f, 'Hello World!');
			expect(fs.readFileSync(f, 'utf8')).to.equal('Hello World!');
		});
	});
});
