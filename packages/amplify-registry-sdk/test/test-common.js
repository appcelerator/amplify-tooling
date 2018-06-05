import { addPackageToConfig, getInstalledPackages, removePackageFromConfig } from '../dist/installers/common';
import { join } from 'path';
import { loadConfig } from '@axway/amplify-cli-utils';
import { removeSync } from 'fs-extra';

const fixturesDir = join(__dirname, 'fixtures');
const userConfig = join(fixturesDir, 'my-config.json');

describe('common utils', () => {

	describe('addPackageToConfig()', () => {
		beforeEach(function () {
			this.config = loadConfig({ userConfig });
		});

		afterEach(function () {
			removeSync(userConfig);
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
			const pluginDir =  join(fixturesDir, 'common', 'foo');
			await addPackageToConfig('foo', pluginDir, this.config, userConfig);
			expect(this.config.get('extensions')).to.deep.equal({
				foo: pluginDir
			});
		});
	});

	describe('removePackageFromConfig()', () => {
		beforeEach(function () {
			this.config = loadConfig({ userConfig });
		});

		afterEach(function () {
			removeSync(userConfig);
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
			const pluginDir =  join(fixturesDir, 'common', 'foo');
			await addPackageToConfig('foo', pluginDir, this.config, userConfig);
			expect(this.config.get('extensions')).to.deep.equal({
				foo: pluginDir
			});
			await addPackageToConfig('bar', pluginDir, this.config, userConfig);
			expect(this.config.get('extensions')).to.deep.equal({
				bar: pluginDir,
				foo: pluginDir
			});
			await removePackageFromConfig('foo', null, this.config, userConfig);
			expect(this.config.get('extensions')).to.deep.equal({
				bar: pluginDir
			});
		});

		it('should allow setting a replacement path', async function () {
			const pluginDir =  join(fixturesDir, 'common', 'foo', '1.0.0');
			const pluginDir2 =  join(fixturesDir, 'common', 'bar', '1.0.0');
			await addPackageToConfig('foo', pluginDir, this.config, userConfig);
			expect(this.config.get('extensions')).to.deep.equal({
				foo: pluginDir
			});
			await removePackageFromConfig('foo', pluginDir2, this.config, userConfig);
			expect(this.config.get('extensions')).to.deep.equal({
				foo: pluginDir2
			});
		});
	});

	describe('getInstalledPackages()', () => {
		beforeEach(function () {
			this.config = loadConfig({ userConfig });
		});

		afterEach(function () {
			removeSync(userConfig);
			this.config = null;
		});

		it('should list all packages', async function () {
			const pluginDir =  join(fixturesDir, 'common', 'foo', '1.0.0');
			const pluginDir2 =  join(fixturesDir, 'common', 'bar', '1.0.0');
			await addPackageToConfig('foo', pluginDir, this.config, userConfig);
			await removePackageFromConfig('bar', pluginDir2, this.config, userConfig);
			const packages = getInstalledPackages(this.config, join(fixturesDir, 'common'));
			expect(packages).to.deep.equal([
				{
					activePath: pluginDir2,
					activeVersion: '1.0.0',
					name: 'bar',
					versions: [ '1.0.0' ],
					versionInfo: {
						'1.0.0': {
							version: '1.0.0',
							installPath: pluginDir2
						}
					}
				},
				{
					activePath: pluginDir,
					activeVersion: '1.0.0',
					name: 'foo',
					versions: [ '1.0.0' ],
					versionInfo: {
						'1.0.0': {
							version: '1.0.0',
							installPath: pluginDir
						}
					}
				},
			]);
		});
	});
});
