import path from 'path';
import fs from 'fs';

import loadConfig, { Config, configFile } from '../../dist/lib/config.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = path.join(__dirname, '../helpers/fixtures/config');
const temp = path.join(__dirname, '../helpers/fixtures/axway-config.json');

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

	afterEach(() => {
		if (fs.existsSync(configFile)) {
			fs.unlinkSync(configFile);
		}
	});

	it('should default to loading amplify config', async () => {
		fs.cpSync(path.join(fixturesDir, 'existing-file.json'), configFile, { force: true });
		const cfg = await loadConfig();
		expect(cfg.data(Config.Base)).to.deep.equal({ existing: true });
	});

	it('should allow a custom userConfig to be passed in', async () => {
		const configFile = path.join(fixturesDir, 'my-own-config.json');
		const cfg = await loadConfig({ configFile });
		expect(cfg.data(Config.Base)).to.deep.equal({ ownConfig: true });
	});
});
