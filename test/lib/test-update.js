import check from '../../dist/lib/update.js';
import fs from 'fs';
import tmp from 'tmp';

process.env.TEST_META_DIR = tmp.dirSync({ prefix: 'lib-update-test' }).name;

describe('update', function () {
	describe('check()', function () {
		beforeEach(() => {
			process.env.FORCE_UPDATE_NOTIFIER = 1;
		});

		afterEach(async () => {
			fs.rmSync(process.env.TEST_META_DIR, { recursive: true, force: true });
		});

		describe('Error handling', () => {
			it('should error if options is not an object', async () => {
				await expect(check('foo')).to.eventually.be.rejectedWith(TypeError, 'Expected options to be an object');
				await expect(check(123)).to.eventually.be.rejectedWith(TypeError, 'Expected options to be an object');
			});

			it('should error if pkg is not a valid object', async () => {
				await expect(check({})).to.eventually.be.rejectedWith(Error, 'Expected pkg to be an object containing name and version properties');
				await expect(check({
					pkg: 'foo'
				})).to.eventually.be.rejectedWith(Error, 'Expected pkg to be an object containing name and version properties');
				await expect(check({
					pkg: {}
				})).to.eventually.be.rejectedWith(Error, 'Expected pkg to be an object containing name and version properties');
				await expect(check({
					pkg: { name: 'foo' }
				})).to.eventually.be.rejectedWith(Error, 'Expected pkg to be an object containing name and version properties');
				await expect(check({
					pkg: { version: '1.2.3' }
				})).to.eventually.be.rejectedWith(Error, 'Expected pkg to be an object containing name and version properties');
			});

			it('should error if distTag is invalid', async () => {
				await expect(check({
					pkg: { name: 'foo', version: '1.2.3' },
					distTag: 123
				})).to.eventually.be.rejectedWith(TypeError, 'Expected distTag to be a non-empty string');

				await expect(check({
					pkg: { name: 'foo', version: '1.2.3' },
					distTag: ''
				})).to.eventually.be.rejectedWith(TypeError, 'Expected distTag to be a non-empty string');

				await expect(check({
					pkg: { name: 'foo', version: '1.2.3' },
					distTag: null
				})).to.eventually.be.rejectedWith(TypeError, 'Expected distTag to be a non-empty string');
			});

			it('should error if metaDir is not a string', async () => {
				await expect(check({
					pkg: { name: 'foo', version: '1.2.3' },
					metaDir: 123
				})).to.eventually.be.rejectedWith(Error, 'Expected metaDir to be a string');
			});
		});

		describe('Environment check skip', () => {
			it('should skip check if NO_UPDATE_NOTIFIER is set', async () => {
				try {
					delete process.env.FORCE_UPDATE_NOTIFIER;
					process.env.NO_UPDATE_NOTIFIER = 1;
					expect(await check()).to.deep.equal({});
				} finally {
					delete process.env.NO_UPDATE_NOTIFIER;
				}
			});

			it('should skip check if NODE_ENV is set to test', async () => {
				try {
					delete process.env.FORCE_UPDATE_NOTIFIER;
					process.env.NODE_ENV = 'test';
					expect(await check()).to.deep.equal({});
				} finally {
					delete process.env.NODE_ENV;
				}
			});
		});

		describe('pkg object', () => {

			it('should check a valid pkg object', async () => {
				const result = await check({
					pkg: {
						name: 'axway',
						version: '0.0.1'
					}
				});

				expect(result.current).to.equal('0.0.1');
				expect(result.distTag).to.equal('latest');
				expect(result.latest).to.not.equal(null);
				expect(result.updateAvailable).to.equal(true);
			});

			it('should fail to find non-existent package', async () => {
				const result = await check({
					pkg: {
						name: 'th1s-packag3-do3s-not-ex1st',
						version: '1.2.3'
					}
				});

				expect(result.current).to.equal('1.2.3');
				expect(result.distTag).to.equal('latest');
				expect(result.latest).to.equal(null);
				expect(result.updateAvailable).to.equal(false);
			});

			it('should error if dist tag does not exist', async () => {
				await expect(check({
					distTag: 'foo',
					pkg: {
						name: 'axway',
						version: '1.2.3'
					}
				})).to.eventually.be.rejectedWith(Error, 'Distribution tag "foo" does not exist');
			});
		});
	});
});
