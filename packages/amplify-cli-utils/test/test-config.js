import path from 'path';
import fs from 'fs-extra';

import loadConfig from '../dist/config';
import { configFile } from '../dist/locations';

const fixturesDir = path.join(__dirname, 'fixtures', 'config');
const temp = path.join(__dirname, 'fixtures', 'axway-config.json');

describe('config', () => {
	before(done => {
		if (fs.existsSync(configFile)) {
			fs.copySync(configFile, temp, { overwrite: true });
			fs.unlinkSync(configFile);
		}
		done();
	});

	after(done => {
		if (fs.existsSync(temp)) {
			fs.copySync(temp, configFile, { overwrite: true });
			fs.unlinkSync(temp);
		}
		// Cleanup incase test fails
		const noExist = path.join(fixturesDir, 'no-exist-config.json');
		if (fs.existsSync(noExist)) {
			fs.unlinkSync(noExist);
		}
		done();
	});

	afterEach(done => {
		if (fs.existsSync(configFile)) {
			fs.unlinkSync(configFile);
		}
		done();
	});

	it('should default to loading amplify config', done => {
		fs.copySync(path.join(fixturesDir, 'existing-file.json'), configFile, { overwrite: true });
		const cfg = loadConfig();
		expect(cfg.toString(0)).to.equal('{"existing":true}');
		done();
	});

	it('should allow a custom userConfig to be passed in', done => {
		const userConfig = path.join(fixturesDir, 'my-own-config.json');
		const cfg = loadConfig({ userConfig });
		expect(cfg.toString(0)).to.equal('{"ownConfig":true}');
		done();
	});

	it('should write userConfig if it does not exist', done => {
		const userConfig = path.join(fixturesDir, 'no-exist-config.json');
		expect(fs.existsSync(userConfig)).to.equal(false);
		const cfg = loadConfig({ userConfig });
		expect(cfg.toString(0)).to.equal('{}');
		fs.unlinkSync(userConfig);
		done();
	});
});
