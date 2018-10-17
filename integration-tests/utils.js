const merge = require('lodash.merge');
const snooplogg = require('snooplogg').default;
const { ensureDirSync, existsSync, readdirSync, moveSync, readJSONSync, removeSync, writeJSONSync } = require('fs-extra');
const { homedir } = require('os');
const { join } = require('path');
const { run } = require('appcd-subprocess');

const axwayHome = join(homedir(), '.axway');
const configFile = join(axwayHome, 'amplify-cli.json');
const isWindows = process.platform === 'win32';
const { log } = snooplogg('amplify-integration:utils');

let amplifyCmd;

function preCheck() {
	console.log(`Home: ${axwayHome}`);
	console.log(`Using ${getAmplifyCommand()} as the amplify binary`);
	if (existsSync(axwayHome)) {
		const contents = readdirSync(axwayHome);
		if (contents.length > 1) {
			throw new Error(`Expected ${axwayHome} to be empty. Please relocate your home dir before running the tests `);
		}
		if (contents.length === 1 && contents.includes('amplify-cli.json')) {
			const backupFile = join(homedir(), `amplify-config-backup-${Date.now()}.json`);
			moveSync(configFile, backupFile);
			console.log(`Moved ${configFile} to ${backupFile}`);
			return backupFile;
		}
	} else {
		ensureDirSync(axwayHome);
	}
}

function restoreConfigFile(backupFile) {
	moveSync(backupFile, configFile, { overwrite: true });
	console.log(`Moved ${backupFile} back to ${configFile} `);

}

function cleanConfig() {
	existsSync(configFile) && writeConfig({});
}

function writeConfig(value) {
	writeJSONSync(configFile, value);
}

function readConfig() {
	return readJSONSync(configFile);
}

function addToConfig(value) {
	const config = readConfig();
	writeConfig(merge(value, config));
}

async function runCommand(args, opts = {}) {
	Object.assign(opts, { ignoreExitCode: true });
	const amplifyCmd = getAmplifyCommand();
	// On Windows we need to spawn the local bin file using node to execute it
	// this is handled by the npm wrapper when we use the global install
	if (isWindows && amplifyCmd !== 'amplify.cmd') {
		args.unshift(amplifyCmd);
		return await run(process.execPath, args, opts);
	}
	log(`Running ${amplifyCmd} with ${args.join(' ')}`)
	const response = await run(amplifyCmd, args, opts);
	log('Response was %j', response);
	return response;
}

function getAmplifyCommand () {
	if (amplifyCmd) {
		return amplifyCmd;
	}
	if (process.env.AMPLIFY_BIN){
		amplifyCmd = process.env.AMPLIFY_BIN;
	} else if(isWindows) {
		amplifyCmd = 'amplify.cmd';
	} else {
		amplifyCmd = 'amplify';
	}

	return amplifyCmd;
}

async function runJSONCommand(args, opts) {
	if (!args.includes('--json')) {
		args.push('--json');
	}
	const resp = await runCommand(args, opts);
	resp.stdout = JSON.parse(resp.stdout || '{}');
	resp.stderr = JSON.parse(resp.stderr || '{}');
	return resp;
}

function cleanup () {
	if (!process.env.CLEANUP) {
		return;
	}
	removeSync(axwayHome);
}

module.exports = {
	addToConfig,
	cleanConfig,
	cleanup,
	preCheck,
	readConfig,
	runJSONCommand,
	writeConfig,
	restoreConfigFile
}
