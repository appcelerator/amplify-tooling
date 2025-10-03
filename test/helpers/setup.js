import path from 'path';
import { rmSync } from 'fs';
import { fileURLToPath } from 'url';

import tmp from 'tmp';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';

import { startServers, stopServers, resetServers } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

global.chai = chai;
global.chai.use(chaiAsPromised);
global.chai.use(sinonChai);
global.expect = global.chai.expect;
global.sinon = sinon;

export const mochaHooks = {
	beforeAll: async function () {
		this.servers = await startServers();
		this.resetServers = resetServers.bind(this);
	},

	beforeEach: function () {
		this.resetServers();
		this.sandbox = global.sinon.createSandbox();
		global.spy = this.sandbox.spy.bind(this.sandbox);
		global.stub = this.sandbox.stub.bind(this.sandbox);
	},

	afterEach: function () {
		this.resetServers();
		delete global.spy;
		delete global.stub;
		this.sandbox.restore();
	},

	afterAll: async function () {
		await stopServers.call(this);
	},
};

rmSync(path.join(__dirname, '.nyc_output'), { force: true });
rmSync(path.join(__dirname, 'coverage'), { force: true });
const tmpHomeDir = tmp.dirSync({
	mode: '755',
	prefix: 'axway-cli-test-home-',
	unsafeCleanup: true
}).name;
console.log(`Protecting home directory, overriding HOME with temp dir: ${tmpHomeDir}`);
process.env.HOME = process.env.USERPROFILE = tmpHomeDir;
if (process.platform === 'win32') {
	process.env.HOMEDRIVE = path.parse(tmpHomeDir).root.replace(/[\\/]/g, '');
	process.env.HOMEPATH = tmpHomeDir.replace(process.env.HOMEDRIVE, '');
}

process.env.NODE_ENV = 'test'; // disables the update check
process.env.FORCE_COLOR = 1;
process.env.SNOOPLOGG_MIN_BRIGHTNESS = '100';
process.env.AXWAY_TEST = '1';
