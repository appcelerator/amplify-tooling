const { existsSync, readdirSync, moveSync, readJSONSync, writeJSONSync } = require('fs-extra');
const { homedir } = require('os');
const { join } = require('path');
const { run } = require('appcd-subprocess');
const isWindows = process.platform === 'win32';

const axwayHome = join(homedir(), '.axway');
const configFile = process.env.AMPLIFY_CONFIG_FILE || join(axwayHome, 'axway-cli', 'config.json');
let amplifyCmd;

function preCheck() {
	console.log(`Home: ${axwayHome}`);
	console.log(`Binary: ${getAmplifyCommand()}`);
	console.log(`Config: ${configFile}`);

	if (existsSync(axwayHome)) {
		const contents = readdirSync(axwayHome);
		if (contents.length > 1) {
			throw new Error(`Expected ${axwayHome} to be empty. Please relocate your home dir before running the tests `);
		}
		if (contents.length === 1 && contents.includes('config.json')) {
			const backupFile = join(homedir(), `amplify-config-backup-${Date.now()}.json`);
			moveSync(configFile, backupFile);
			console.log(`Moved ${configFile} to ${backupFile}`);
			return backupFile;
		}
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

async function runCommand(args, opts = {}) {
	Object.assign(opts, { ignoreExitCode: true });
	opts.env = {
		...opts.env,
		...process.env
	};
	delete opts.env.SNOOPLOGG;

	const amplifyCmd = getAmplifyCommand();
	// On Windows we need to spawn the local bin file using node to execute it
	// this is handled by the npm wrapper when we use the global install
	if (isWindows && amplifyCmd !== 'axway.cmd') {
		args.unshift(amplifyCmd);
		return await run(process.execPath, args, opts);
	}
	return await run(amplifyCmd, args, opts);
}

function getAmplifyCommand () {
	if (amplifyCmd) {
		return amplifyCmd;
	}
	if (process.env.AMPLIFY_BIN){
		amplifyCmd = process.env.AMPLIFY_BIN;
	} else if(isWindows) {
		amplifyCmd = 'axway.cmd';
	} else {
		amplifyCmd = 'axway';
	}

	return amplifyCmd;
}

async function runJSONCommand(args, opts) {
	if (!args.includes('--json')) {
		args.push('--json');
	}
	const resp = await runCommand(args, opts);
	resp.stdout = resp.stdout.trim() === 'undefined' ? 'undefined' :  JSON.parse(resp.stdout);
	return resp;
}

module.exports = {
	cleanConfig,
	preCheck,
	readConfig,
	runJSONCommand,
	writeConfig,
	restoreConfigFile
}
