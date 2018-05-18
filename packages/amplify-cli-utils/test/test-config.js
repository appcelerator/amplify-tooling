import path from 'path';
import fs from 'fs-extra';

import * as config from '../dist/config';
import { configFile } from '../dist/locations';

const fixturesDir = path.join(__dirname, 'fixtures', 'config');
const temp = path.join(__dirname, 'fixtures', 'axway-config.json');
describe('config', () => {
	before(done => {
		if (fs.existsSync(configFile)) {
			fs.copyFileSync(configFile, temp, { overwrite: true });
			fs.unlinkSync(configFile);
		}
		done();
	});

	after(done => {
		if (fs.existsSync(temp)) {
			fs.copyFileSync(temp, configFile, { overwrite: true });
			fs.unlinkSync(temp);
		}
		done();
	});

	afterEach(done => {
		fs.unlinkSync(configFile);
		done();
	});

	describe('readConfig()', () => {

		it('should handle reading when no file exists', done => {
			const cfg = config.read();
			expect(cfg).to.deep.equal({});
			done();
		});

		it('should handle reading when a file does exist', done => {
			fs.copyFileSync(path.join(fixturesDir, 'existing-file.json'), configFile, { overwrite: true });
			const cfg = config.read();
			expect(cfg).to.deep.equal({ existing: true });
			done();
		});
	});

	describe('writeConfig()', () => {

		it('should write a config', done => {
			config.write({ writeTest: true });
			const cfg = config.read();
			expect(cfg).to.deep.equal({ writeTest: true });
			done();
		});
	});

});
