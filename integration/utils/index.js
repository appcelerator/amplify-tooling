const { existsSync, readdirSync, moveSync, readJSONSync, writeJSONSync } = require('fs-extra');
const { homedir } = require('os');
const { join } = require('path');
const { run } = require('appcd-subprocess');

const axwayHome = join(homedir(), '.axway');
const configFile = join(axwayHome, 'amplify-cli.json');

function preCheck() {
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
	}
}

function restoreConfigFile(backupFile) {
	moveSync(backupFile, configFile, { overwrite: true });
	console.log(`Moved ${backupFile} back to ${configFile} `);

}

function cleanConfig() {
	writeConfig({});
}

function writeConfig(value) {
	writeJSONSync(configFile, value);
}

function readConfig() {
	return readJSONSync(configFile);
}

async function runCommand(args, opts = {}) {
	Object.assign(opts, { ignoreExitCode: true });
	const amplifyCmd = process.env.AMPLIFY_BIN ? process.env.AMPLIFY_BIN : 'amplify';
	return await run(amplifyCmd, args, opts);
}

async function runJSONCommand(args, opts) {
	if (!args.includes('--json')) {
		args.push('--json');
	}
	const resp = await runCommand(args, opts);
	resp.stdout = JSON.parse(resp.stdout);
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
