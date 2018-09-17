const { expect } = require('chai'); 
const { cleanConfig, preCheck, readConfig, restoreConfigFile, runJSONCommand, writeConfig } = require('./utils');
let backupFile;

describe('amplify config integration tests', function () {
	this.timeout(5000);

	before(function () {
		backupFile = preCheck();
	});

	beforeEach(function () {
		cleanConfig();
	});

	after(function () {
		if (backupFile) {
			restoreConfigFile(backupFile);
		}
	});

	it('config should exist', async function () {
		const { code, stdout } = await runJSONCommand([ 'config', '--help' ]);
		expect(code).to.equal(2);
		expect(stdout.desc).to.equal('Get and set config options');
	});

	it('config can set values', async function () {
		const { code, stdout } = await runJSONCommand(['config', 'set', 'foo', 'bar' ]);
		expect(code).to.equal(0);
		expect(stdout.code).to.equal(0);
		expect(stdout.result).to.equal('Saved');

		const config = readConfig();
		expect(config).to.deep.equal({ foo: 'bar' });
	});

	[ 'get', 'ls', 'list'].forEach( function (getCommand) {
		it(`config can list a specific value with ${getCommand}`, async function () {
			writeConfig({ 
				foo: 'bar'
			});
	
			const getCmd =  await runJSONCommand([ 'config', getCommand, 'foo' ]);
			expect(getCmd.code).to.equal(0);
			expect(getCmd.stdout.result).to.equal('bar');
		});

		it(`config can list entire config with ${getCommand}`, async function () {
			writeConfig({ 
				foo: 'bar',
				bar: 'foo'
			});
			
			const getCmd =  await runJSONCommand([ 'config', getCommand ]);
			expect(getCmd.code).to.equal(0);
			expect(getCmd.stdout.code).to.equal(0);
			expect(getCmd.stdout.result).to.deep.equal({ bar: 'foo', foo: 'bar' });
		});
	})

	it('config can list entire config', async function () {
		writeConfig({ 
			foo: 'bar',
			bar: 'foo'
		});
		
		const getCmd =  await runJSONCommand([ 'config', 'get' ]);
		expect(getCmd.code).to.equal(0);
		expect(getCmd.stdout.code).to.equal(0);
		expect(getCmd.stdout.result).to.deep.equal({ bar: 'foo', foo: 'bar' });
	});

	[ 'delete', 'rm', 'remove', 'unset' ].forEach(function(removalCommand) {

		it(`config can delete values with ${removalCommand}`, async function () {
			writeConfig({ 
				foo: 'bar'
			});
	
			const deleteCmd = await runJSONCommand([ 'config', removalCommand, 'foo' ]);
			expect(deleteCmd.code).to.equal(0);
			expect(deleteCmd.stdout.code).to.equal(0);
			expect(deleteCmd.stdout.result).to.equal('Saved');
	
			const getCmd =  await runJSONCommand([ 'config', 'get', 'foo' ]);
			expect(getCmd.code).to.equal(6);
			expect(getCmd.code).to.equal(6);
			expect(getCmd.stdout.result).to.equal('Not Found: foo');
		});

	});

	it('config can push to arrays', async function () {
		writeConfig({ 
			foo: [ 'avalue' ]
		});

		const pushCmd = await runJSONCommand([ 'config', 'push', 'foo', 'bar' ]);
		expect(pushCmd.code).to.equal(0);
		expect(pushCmd.code).to.equal(0);
		expect(pushCmd.stdout.result).to.deep.equal([ 'avalue', 'bar' ]);

		const config = readConfig();
		expect(config).to.deep.equal({ foo: [ 'avalue', 'bar' ] });

		const invalidShiftCmd = await runJSONCommand([ 'config', 'push', 'bar', 'foo' ]);
		expect(invalidShiftCmd.code).to.equal(0);
		expect(invalidShiftCmd.stdout.code).to.equal(0);
		expect(invalidShiftCmd.stdout.result).to.deep.equal([ 'foo' ]);
	});

	it('config can pop values from arrays', async function () {
		writeConfig({ 
			foo: [ 'avalue', 'poppedval' ]
		});

		const popCmd = await runJSONCommand([ 'config', 'pop', 'foo' ]);
		expect(popCmd.code).to.equal(0);
		expect(popCmd.code).to.equal(0);
		expect(popCmd.stdout.result).to.equal('poppedval');

		const config = readConfig();
		expect(config).to.deep.equal({ foo: [ 'avalue' ] });

		const invalidPopCmd = await runJSONCommand([ 'config', 'pop', 'bar' ]);
		expect(invalidPopCmd.code).to.equal(6);
		expect(invalidPopCmd.stdout.code).to.equal(6);
		expect(invalidPopCmd.stdout.result).to.equal('Not Found: bar');
	});

	it('config can shift values from arrays', async function () {
		writeConfig({ 
			foo: [ 'shiftedval', 'bar' ]
		});

		const shiftCmd = await runJSONCommand([ 'config', 'shift', 'foo' ]);
		expect(shiftCmd.code).to.equal(0);
		expect(shiftCmd.code).to.equal(0);
		expect(shiftCmd.stdout.result).to.equal('shiftedval');

		const config = readConfig();
		expect(config).to.deep.equal({ foo: [ 'bar' ] });

		const invalidShiftCmd = await runJSONCommand([ 'config', 'shift', 'bar' ]);
		expect(invalidShiftCmd.code).to.equal(6);
		expect(invalidShiftCmd.stdout.code).to.equal(6);
		expect(invalidShiftCmd.stdout.result).to.equal('Not Found: bar');
	});

	it('config can unshift values to an array', async function () {
		writeConfig({
			foo: [ 'bar' ]
		});

		const pushCmd = await runJSONCommand([ 'config', 'unshift', 'foo', 'unshiftedval' ]);
		expect(pushCmd.code).to.equal(0);
		expect(pushCmd.code).to.equal(0);
		expect(pushCmd.stdout.result).to.deep.equal([ 'unshiftedval', 'bar']);

		const config = readConfig();
		expect(config).to.deep.equal({ foo: [ 'unshiftedval', 'bar' ] });

		const invalidShiftCmd = await runJSONCommand([ 'config', 'unshift', 'bar', 'foo' ]);
		expect(invalidShiftCmd.code).to.equal(0);
		expect(invalidShiftCmd.stdout.code).to.equal(0);
		expect(invalidShiftCmd.stdout.result).to.deep.equal([ 'foo' ]);
	});
});
