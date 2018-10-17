const { expect } = require('chai'); 
const {
	addToConfig,
	cleanConfig,
	preCheck,
	readConfig,
	restoreConfigFile,
	runJSONCommand,
	writeConfig 
} = require('../utils');
let backupFile;

describe('pm install', function() {
	this.timeout(10000);

	before(function () {
		backupFile = preCheck();
	});

	beforeEach(function () {
		cleanConfig();
		writeConfig({
			env: 'preprod'
		});
	});

	after(function () {
		if (backupFile) {
			restoreConfigFile(backupFile);
		}
	});

	it('pm install should exist', async function () {
		const { code, stdout } = await runJSONCommand([ 'pm', 'install', '--help' ]);
		expect(code).to.equal(2);
		expect(stdout.desc).to.equal('Installs the specified package');
	});

	it('should be able to install a package', async function () {
		const { code, stdout } = await runJSONCommand([ 'pm', 'install', 'amplify-integration-test' ]);
		expect(code).to.equal(0);
		expect(stdout).to.deep.equal({
			success: true,
			name: 'amplify-integration-test',
			version: '1.0.0',
			messages: []
		});
	});

	it('should error when package doesnt not exist', async function () {
		const { code, stderr } = await runJSONCommand([ 'pm', 'install', 'non-extisting-package' ]);
		expect(code).to.equal(1);
		expect(stderr).to.deep.equal({
			success: false,
			message: 'No version data for non-extisting-package@latest'
		});
	});

	it('should error when no connection to registry', async function () {
		addToConfig({
			network: {
				httpProxy: 'http://foo.bar'
			}
		});
		const { code, stderr } = await runJSONCommand([ 'pm', 'install', 'amplify-integration-test' ]);
		expect(code).to.equal(3);
		expect(stderr).to.deep.equal({
			success: false,
			message: 'Unable to connect to registry server'
		});
	});
});
