const { expect } = require('chai');
const { cleanConfig, preCheck, readConfig, restoreConfigFile, runJSONCommand, writeConfig } = require('./utils');
let backupFile;

const isAmplify = process.env.AMPLIFY_BIN && require('path').basename(process.env.AMPLIFY_BIN) === 'amplify';

describe(`${isAmplify ? 'amplify' : 'axway'} config integration tests`, function () {
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
		expect(stdout.desc).to.equal('Manage configuration options');
	});

	it('config can set values', async function () {
		const { code, stdout } = await runJSONCommand(['config', 'set', 'foo', 'bar' ]);
		expect(code).to.equal(0);

		if (isAmplify) {
			expect(stdout.result).to.equal('Saved');
		} else {
			expect(stdout).to.equal('OK');
		}

		const config = readConfig();
		expect(config).to.deep.equal({ foo: 'bar' });
	});

	it(`config can list a specific value with get`, async function () {
		writeConfig({
			foo: 'bar'
		});

		const getCmd =  await runJSONCommand([ 'config', 'get', 'foo' ]);
		expect(getCmd.code).to.equal(0);
		if (isAmplify) {
			expect(getCmd.stdout.result).to.equal('bar');
		} else {
			expect(getCmd.stdout).to.equal('bar');
		}
	});

	[ 'get', 'ls', 'list'].forEach( function (getCommand) {
		it(`config can list entire config with ${getCommand}`, async function () {
			writeConfig({
				foo: 'bar',
				bar: 'foo'
			});

			const getCmd =  await runJSONCommand([ 'config', getCommand ]);
			expect(getCmd.code).to.equal(0);
			if (isAmplify) {
				expect(getCmd.stdout.result).to.deep.equal({ bar: 'foo', foo: 'bar' });
			} else {
				expect(getCmd.stdout).to.deep.equal({ bar: 'foo', foo: 'bar' });
			}
		});
	})

	it('config can list entire config', async function () {
		writeConfig({
			foo: 'bar',
			bar: 'foo'
		});

		const getCmd =  await runJSONCommand([ 'config', 'get' ]);
		expect(getCmd.code).to.equal(0);
		if (isAmplify) {
			expect(getCmd.stdout.result).to.deep.equal({ bar: 'foo', foo: 'bar' });
		} else {
			expect(getCmd.stdout).to.deep.equal({ bar: 'foo', foo: 'bar' });
		}
	});

	[ 'delete', 'rm', 'remove', 'unset' ].forEach(function(removalCommand) {
		it(`config can delete values with ${removalCommand}`, async function () {
			writeConfig({
				foo: 'bar'
			});

			const deleteCmd = await runJSONCommand([ 'config', removalCommand, 'foo' ]);
			expect(deleteCmd.code).to.equal(0);
			if (isAmplify) {
				expect(deleteCmd.stdout.result).to.equal('Saved');
			} else {
				expect(deleteCmd.stdout).to.equal('OK');
			}

			const getCmd =  await runJSONCommand([ 'config', 'get', 'foo' ]);
			expect(getCmd.code).to.equal(6);
			if (isAmplify) {
				expect(getCmd.stdout.result).to.equal('Not Found: foo');
			} else {
				expect(getCmd.stdout).to.equal('undefined');
			}
		});
	});

	it('config can push to arrays', async function () {
		writeConfig({
			foo: [ 'avalue' ]
		});

		const pushCmd = await runJSONCommand([ 'config', 'push', 'foo', 'bar' ]);
		expect(pushCmd.code).to.equal(0);
		if (isAmplify) {
			expect(pushCmd.stdout.result).to.deep.equal([ 'avalue', 'bar' ]);
		} else {
			expect(pushCmd.stdout).to.equal('OK');
		}

		const config = readConfig();
		expect(config).to.deep.equal({ foo: [ 'avalue', 'bar' ] });

		const invalidShiftCmd = await runJSONCommand([ 'config', 'push', 'bar', 'foo' ]);
		expect(invalidShiftCmd.code).to.equal(0);
		if (isAmplify) {
			expect(invalidShiftCmd.stdout.result).to.deep.equal([ 'foo' ]);
		} else {
			expect(invalidShiftCmd.stdout).to.equal('OK');
		}
	});

	it('config can pop values from arrays', async function () {
		writeConfig({
			foo: [ 'avalue', 'poppedval' ]
		});

		const popCmd = await runJSONCommand([ 'config', 'pop', 'foo' ]);
		expect(popCmd.code).to.equal(0);
		if (isAmplify) {
			expect(popCmd.stdout.result).to.equal('poppedval');
		} else {
			expect(popCmd.stdout).to.equal('poppedval');
		}

		const config = readConfig();
		expect(config).to.deep.equal({ foo: [ 'avalue' ] });

		const invalidPopCmd = await runJSONCommand([ 'config', 'pop', 'bar' ]);
		if (isAmplify) {
			expect(invalidPopCmd.code).to.equal(6);
			expect(invalidPopCmd.stdout.result).to.equal('Not Found: bar');
		} else {
			expect(invalidPopCmd.code).to.equal(0);
			expect(invalidPopCmd.stdout).to.equal('undefined');
		}
	});

	it('config can shift values from arrays', async function () {
		writeConfig({
			foo: [ 'shiftedval', 'bar' ]
		});

		const shiftCmd = await runJSONCommand([ 'config', 'shift', 'foo' ]);
		expect(shiftCmd.code).to.equal(0);
		if (isAmplify) {
			expect(shiftCmd.stdout.result).to.equal('shiftedval');
		} else {
			expect(shiftCmd.stdout).to.equal('shiftedval');
		}

		const config = readConfig();
		expect(config).to.deep.equal({ foo: [ 'bar' ] });

		const invalidShiftCmd = await runJSONCommand([ 'config', 'shift', 'bar' ]);
		if (isAmplify) {
			expect(invalidShiftCmd.code).to.equal(6);
			expect(invalidShiftCmd.stdout.result).to.equal('Not Found: bar');
		} else {
			expect(invalidShiftCmd.code).to.equal(0);
			expect(invalidShiftCmd.stdout).to.equal('undefined');
		}
	});

	it('config can unshift values to an array', async function () {
		writeConfig({
			foo: [ 'bar' ]
		});

		const pushCmd = await runJSONCommand([ 'config', 'unshift', 'foo', 'unshiftedval' ]);
		expect(pushCmd.code).to.equal(0);
		if (isAmplify) {
			expect(pushCmd.stdout.result).to.deep.equal([ 'unshiftedval', 'bar']);
		} else {
			expect(pushCmd.stdout).to.equal('OK');
		}

		const config = readConfig();
		expect(config).to.deep.equal({ foo: [ 'unshiftedval', 'bar' ] });

		const invalidShiftCmd = await runJSONCommand([ 'config', 'unshift', 'bar', 'foo' ]);
		expect(invalidShiftCmd.code).to.equal(0);
		if (isAmplify) {
			expect(invalidShiftCmd.stdout.result).to.deep.equal([ 'foo' ]);
		} else {
			expect(invalidShiftCmd.stdout).to.equal('OK');
		}
	});
});
