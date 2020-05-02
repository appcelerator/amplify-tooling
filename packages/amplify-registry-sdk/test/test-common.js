/* eslint-disable security/detect-child-process */

import fs from 'fs-extra';
import tmp from 'tmp';

import { addPackageToConfig, extractTar, getInstalledPackages, npmInstall, removePackageFromConfig } from '../dist/installers/common';
import { join } from 'path';
import { loadConfig } from '@axway/amplify-cli-utils';
import { EventEmitter } from 'events';

tmp.setGracefulCleanup();

// We need to require this in order to mock it
const child_process = require('child_process');
const tar = require('tar');

const configFile = tmp.tmpNameSync({ prefix: 'test-amplify-registry-sdk-', postfix: '.json' });
const fixturesDir = join(__dirname, 'fixtures');

describe('common utils', () => {
	describe('addPackageToConfig()', () => {
		beforeEach(function () {
			this.config = loadConfig({ configFile });
		});

		afterEach(function () {
			fs.removeSync(configFile);
			this.config = null;
		});

		it('should error if no name', () => {
			return expect(addPackageToConfig()).to.be.rejectedWith(TypeError, 'Expected name to be a valid string');
		});

		it('should error if no path', () => {
			return expect(addPackageToConfig('foo')).to.be.rejectedWith(TypeError, 'Expected path to be a valid string');
		});

		it('should error if path does not exist', () => {
			return expect(addPackageToConfig('foo', join(fixturesDir, 'no-exist'))).to.be.rejectedWith(Error, 'Expected package path to exist');
		});

		it('should add a package to the config', async function () {
			const pluginDir = join(fixturesDir, 'common', 'packages', 'foo');
			await addPackageToConfig('foo', pluginDir, this.config);
			expect(this.config.get('extensions')).to.deep.equal({
				foo: pluginDir
			});
		});

		it('should add a scoped package to the config', async function () {
			const pluginDir = join(fixturesDir, 'common', 'packages', '@bob', 'bobs-cli');
			await addPackageToConfig('@bob/bobs-cli', pluginDir, this.config);
			expect(this.config.get('extensions')).to.deep.equal({
				'@bob/bobs-cli': pluginDir
			});
		});
	});

	describe('removePackageFromConfig()', () => {
		beforeEach(function () {
			this.configFile = tmp.tmpNameSync({ prefix: 'test-amplify-registry-sdk-', postfix: '.json' });
			fs.outputJSONSync(this.configFile, {});
			this.config = loadConfig({ configFile: this.configFile });
		});

		afterEach(function () {
			fs.removeSync(this.configFile);
			this.config = null;
		});

		it('should error if no name', () => {
			return expect(removePackageFromConfig()).to.be.rejectedWith(TypeError, 'Expected name to be a valid string');
		});

		it('should error if invalid replacement path', () => {
			return expect(removePackageFromConfig('foo', 123)).to.be.rejectedWith(TypeError, 'Expected replacementPath to be a valid string');
		});

		it('should error if replacement path does not exist', () => {
			return expect(removePackageFromConfig('foo', join(fixturesDir, 'no-exist'))).to.be.rejectedWith(Error, 'Expected replacementPath to exist');
		});

		it('should remove a package from the config', async function () {
			const pluginDir = join(fixturesDir, 'common', 'packages', 'foo');
			await addPackageToConfig('foo', pluginDir, this.config);
			expect(this.config.get('extensions')).to.deep.equal({
				foo: pluginDir
			});
			await addPackageToConfig('bar', pluginDir, this.config);
			expect(this.config.get('extensions')).to.deep.equal({
				bar: pluginDir,
				foo: pluginDir
			});
			await removePackageFromConfig('foo', null, this.config);
			expect(this.config.get('extensions')).to.deep.equal({
				bar: pluginDir
			});
		});

		it('should allow setting a replacement path', async function () {
			const pluginDir = join(fixturesDir, 'common', 'packages', 'foo', '1.0.0');
			const pluginDir2 = join(fixturesDir, 'common', 'packages', 'bar', '1.0.0');
			await addPackageToConfig('foo', pluginDir, this.config);
			expect(this.config.get('extensions')).to.deep.equal({
				foo: pluginDir
			});
			await removePackageFromConfig('foo', pluginDir2, this.config);
			expect(this.config.get('extensions')).to.deep.equal({
				foo: pluginDir2
			});
		});
	});

	describe('getInstalledPackages()', () => {
		beforeEach(function () {
			this.configFile = tmp.tmpNameSync({ prefix: 'test-amplify-registry-sdk-', postfix: '.json' });
			fs.outputJSONSync(this.configFile, {});
			this.config = loadConfig({ configFile: this.configFile });
		});

		afterEach(function () {
			fs.removeSync(this.configFile);
			this.config = null;
		});

		it('should list all packages', async function () {
			const pluginDir = join(fixturesDir, 'common', 'packages', 'foo', '1.0.0');
			const pluginDir2 = join(fixturesDir, 'common', 'packages', 'bar', '1.0.0');
			const pluginDir3 = join(fixturesDir, 'common', 'packages', '@bob', 'bobs-cli', '1.0.0');
			await addPackageToConfig('foo', pluginDir, this.config);
			await addPackageToConfig('bar', pluginDir2, this.config);
			await addPackageToConfig('@bob/bobs-cli', pluginDir3, this.config);
			const packages = getInstalledPackages({}, this.config, join(fixturesDir, 'common', 'packages'));
			expect(packages).to.deep.equal([
				{
					name: '@bob/bobs-cli',
					description: 'bobs cli that is published as a scoped plugin as he rocks',
					version: '1.0.0',
					versions: {
						'1.0.0': {
							managed: true,
							path: pluginDir3
						}
					}
				},
				{
					name: 'bar',
					description: 'a second plugin',
					version: '1.0.0',
					versions: {
						'1.0.0': {
							managed: true,
							path: pluginDir2
						}
					}
				},
				{
					description: 'a first plugin',
					name: 'foo',
					version: '1.0.0',
					versions: {
						'1.0.0': {
							managed: true,
							path: pluginDir
						}
					}
				}
			]);
		});

		it('should allow specifying a single package to filter', async function () {
			const pluginDir = join(fixturesDir, 'common', 'packages', 'foo', '1.0.0');
			const pluginDir2 = join(fixturesDir, 'common', 'packages', 'bar', '1.0.0');
			const pluginDir3 = join(fixturesDir, 'common', 'packages', '@bob', 'bobs-cli', '1.0.0');
			await addPackageToConfig('foo', pluginDir, this.config);
			await addPackageToConfig('bar', pluginDir2, this.config);
			await addPackageToConfig('@bob/bobs-cli', pluginDir3, this.config);
			const packages = getInstalledPackages({ packageName: 'bar' }, this.config, join(fixturesDir, 'common', 'packages'));
			expect(packages).to.deep.equal([
				{
					name: 'bar',
					description: 'a second plugin',
					version: '1.0.0',
					versions: {
						'1.0.0': {
							managed: true,
							path: pluginDir2
						}
					}
				}
			]);
		});
	});

	describe('npminstall()', function () {
		beforeEach(function () {
			this.fakeChild = new EventEmitter();
			this.fakeChild.stdout = new EventEmitter();
			this.fakeChild.stderr = new EventEmitter();
			this.sandbox.stub(child_process, 'spawn').returns(this.fakeChild);
		});

		afterEach(function () {
			this.fakeChild = null;
			this.sandbox.restore();
		});

		it('should error if no package.json', () => {
			return expect(npmInstall({ directory: join(fixturesDir, 'common'), npm: 'npm' })).to.be.rejectedWith(Error, 'Directory does not contain a package.json');
		});

		it('should run npm install', async function () {
			this.timeout(25000);
			setTimeout(() => {
				this.fakeChild.stdout.emit('data', '');
				this.fakeChild.emit('close');
			}, 1000);
			await npmInstall({ directory: join(fixturesDir, 'common', 'npm-install-dir'), npm: 'npm' });
		});

		it('should error if npm install fails', function () {
			this.timeout(25000);
			setTimeout(() => {
				this.fakeChild.stdout.emit('data', '');
				this.fakeChild.emit('close', 1);
			}, 1000);
			return expect(npmInstall({ directory: join(fixturesDir, 'common', 'npm-install-dir'), npm: 'npm' })).to.be.rejectedWith(Error, 'Subprocess exited with code 1');
		});

		it('should attempt to find npm if no npm executable is passed in', async function () {
			this.timeout(25000);
			setTimeout(() => {
				this.fakeChild.stdout.emit('data', '');
				this.fakeChild.emit('close');
			}, 1000);
			await npmInstall({ directory: join(fixturesDir, 'common', 'npm-install-dir') });
		});
	});

	describe('extract()', function () {
		beforeEach(function () {
			this.sandbox.stub(tar, 'extract').resolves();
		});

		it('should extract contents', () => {
			return expect(extractTar({ file: 'test.tgz', dest: join(fixturesDir, 'common', 'extract-dir') })).to.be.fulfilled;
		});
	});
});
