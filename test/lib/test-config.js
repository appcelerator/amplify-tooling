import path from 'path';
import fs from 'fs';

import { loadConfig, Config, configFile } from '../../dist/lib/config.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, '../helpers/fixtures/config');
const temp = path.join(__dirname, '../helpers/fixtures/config/axway-config.json');

describe('config', () => {
	before(() => {
		if (fs.existsSync(configFile)) {
			fs.cpSync(configFile, temp, { force: true });
			fs.unlinkSync(configFile);
		}
	});

	after(() => {
		if (fs.existsSync(temp)) {
			fs.cpSync(temp, configFile, { force: true });
			fs.unlinkSync(temp);
		}
		// Cleanup in case test fails
		const noExist = path.join(fixturesDir, 'no-exist-config.json');
		if (fs.existsSync(noExist)) {
			fs.unlinkSync(noExist);
		}
	});

	describe('Config', () => {
		const sampleData = { foo: 'bar', baz: { qux: 42, quux: true }, corge: [ 1, 2, 3 ] };
		const sampleFile = path.join(fixturesDir, 'test-config.json');

		describe('init()', () => {
			it('should throw an error if file is not provided', () => {
				expect(() => new Config().init()).to.throw(
					TypeError,
					'Expected file to be a string path to a .json file'
				);
			});

			it('should throw an error if file is not a .json file', () => {
				expect(() => new Config().init({ file: '/path/to/config.txt' })).to.throw(
					TypeError,
					'Expected file to be a string path to a .json file'
				);
			});

			it('should initialize a config instance', () => {
				const cfg = new Config().init({ file: sampleFile });
				expect(cfg.data()).to.deep.equal({});
			});

			it('should initialize config with data', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				expect(cfg.data()).to.deep.equal(sampleData);
			});
		});

		describe('load()', () => {
			afterEach(() => {
				if (fs.existsSync(sampleFile)) {
					fs.unlinkSync(sampleFile);
				}
			});

			it('should load data from file', () => {
				fs.writeFileSync(sampleFile, JSON.stringify(sampleData, null, 2), 'utf8');
				const cfg = new Config().init({ file: sampleFile });
				cfg.load();
				expect(cfg.data()).to.deep.equal(sampleData);
			});

			it('should error on non-existent file', () => {
				const cfg = new Config().init({ file: sampleFile });
				expect(() => cfg.load()).to.throw(
					Error,
					`Failed to load config file: ENOENT: no such file or directory, open '${sampleFile}'`
				);
			});
		});

		describe('data()', () => {
			it('should return a deep clone of the data', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				const dataClone = cfg.data();
				expect(dataClone).to.deep.equal(sampleData);
				// Modify the clone and ensure original is unaffected
				dataClone.baz.qux = 999;
				expect(cfg.get('baz.qux')).to.equal(42);
			});
		});

		describe('get()', () => {

			it('should get a value by key', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				expect(cfg.get('foo')).to.equal('bar');
				expect(cfg.get('baz')).to.deep.equal({ qux: 42, quux: true });
			});

			it('should return undefined for non-existent key', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				expect(cfg.get('notfound')).to.be.undefined;
			});

			it('should return the default value for non-existent key', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				expect(cfg.get('notfound', 'defaultValue')).to.equal('defaultValue');
			});

			it('should handle nested keys using dot notation', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				expect(cfg.get('baz.qux')).to.equal(42);
				expect(cfg.get('corge.1')).to.equal(2);
			});
		});

		describe('set()', () => {

			it('should set a value by key', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				cfg.set('newKey', 'newValue');
				expect(cfg.get('newKey')).to.equal('newValue');
			});

			it('should update an existing key', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				cfg.set('foo', 'updated');
				expect(cfg.get('foo')).to.equal('updated');
			});

			it('should set nested keys using dot notation', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				cfg.set('baz.qux', 100);
				expect(cfg.get('baz.qux')).to.equal(100);
			});
		});

		describe('has()', () => {

			it('should return true for existing key', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				expect(cfg.has('foo')).to.be.true;
			});

			it('should return false for non-existent key', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				expect(cfg.has('notfound')).to.be.false;
			});

			it('should handle nested keys using dot notation', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				expect(cfg.has('baz.qux')).to.be.true;
				expect(cfg.has('baz.nonexistent')).to.be.false;
			});
		});

		describe('delete()', () => {

			it('should delete a key', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				expect(cfg.get('foo')).to.equal('bar');
				cfg.delete('foo');
				expect(cfg.get('foo')).to.be.undefined;
			});

			it('should delete nested keys using dot notation', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				expect(cfg.get('baz.qux')).to.equal(42);
				cfg.delete('baz.qux');
				expect(cfg.get('baz.qux')).to.be.undefined;
			});
		});

		describe('push()', () => {

			it('should push a value onto an array', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				cfg.push('corge', 4);
				expect(cfg.get('corge')).to.deep.equal([ 1, 2, 3, 4 ]);
			});

			it('should create an array if key does not exist', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				cfg.push('newArray', 'firstItem');
				expect(cfg.get('newArray')).to.deep.equal([ 'firstItem' ]);
			});
		});

		describe('pop()', () => {

			it('should pop a value from an array', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				const popped = cfg.pop('corge');
				expect(popped).to.equal(3);
				expect(cfg.get('corge')).to.deep.equal([ 1, 2 ]);
			});

			it('should error when popping from non-array key', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				expect(() => cfg.pop('foo')).to.throw(
					TypeError,
					'Expected config key "foo" to be an array'
				);
			});
		});

		describe('shift()', () => {

			it('should shift a value from an array', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				const shifted = cfg.shift('corge');
				expect(shifted).to.equal(1);
				expect(cfg.get('corge')).to.deep.equal([ 2, 3 ]);
			});

			it('should error when shifting from non-array key', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				expect(() => cfg.shift('foo')).to.throw(
					TypeError,
					'Expected config key "foo" to be an array'
				);
			});
		});

		describe('unshift()', () => {

			it('should unshift a value onto an array', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				cfg.unshift('corge', 0);
				expect(cfg.get('corge')).to.deep.equal([ 0, 1, 2, 3 ]);
			});

			it('should create an array if key does not exist', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				cfg.unshift('newArray', 'firstItem');
				expect(cfg.get('newArray')).to.deep.equal([ 'firstItem' ]);
			});
		});

		describe('keys()', () => {

			it('should return all top-level keys', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				const keys = cfg.keys();
				expect(keys).to.have.members([ 'foo', 'baz', 'corge' ]);
			});
		});

		describe('save()', () => {

			afterEach(() => {
				if (fs.existsSync(sampleFile)) {
					fs.unlinkSync(sampleFile);
				}
			});

			it('should save data to file', () => {
				fs.writeFileSync(sampleFile, '', 'utf8');
				let fileContent = fs.readFileSync(sampleFile, 'utf8');
				expect(fileContent).to.equal('');

				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				cfg.save();
				fileContent = fs.readFileSync(sampleFile, 'utf8');
				expect(JSON.parse(fileContent)).to.deep.equal(sampleData);
			});
		});

		describe('toString()', () => {

			it('should return data as JSON string', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				const jsonString = cfg.toString();
				const expectedString = JSON.stringify(sampleData, null, 2);
				expect(jsonString).to.equal(expectedString);
			});

			it('should use the specified indentation level', () => {
				const cfg = new Config().init({ file: sampleFile, data: sampleData });
				const jsonString = cfg.toString(4);
				const expectedString = JSON.stringify(sampleData, null, 4);
				expect(jsonString).to.equal(expectedString);
			});
		});
	});

	describe('loadConfig()', () => {

		afterEach(() => {
			if (fs.existsSync(configFile)) {
				fs.unlinkSync(configFile);
			}
		});

		it('should default to loading amplify config', async () => {
			fs.cpSync(path.join(fixturesDir, 'existing-file.json'), configFile, { force: true });
			const cfg = await loadConfig();
			expect(cfg.data()).to.deep.equal({ existing: true });
		});

		it('should allow a custom userConfig to be passed in', async () => {
			const customFile = path.join(fixturesDir, 'my-own-config.json');
			const cfg = await loadConfig({ configFile: customFile });
			expect(cfg.data()).to.deep.equal({ ownConfig: true });
		});
	});
});
