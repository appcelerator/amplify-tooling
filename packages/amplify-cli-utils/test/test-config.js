import path from 'path';
import fs from 'fs-extra';

import { Config } from '@axway/amplify-config';
import { loadConfig, locations } from '../dist/index';

const { configFile } = locations;
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
		expect(cfg.data(Config.Base)).to.deep.equal({ existing: true });
		done();
	});

	it('should allow a custom userConfig to be passed in', done => {
		const configFile = path.join(fixturesDir, 'my-own-config.json');
		const cfg = loadConfig({ configFile });
		expect(cfg.data(Config.Base)).to.deep.equal({ ownConfig: true });
		done();
	});
});
