import chalk from 'chalk';
import fs from 'fs-extra';
import Mustache from 'mustache';
import os from 'os';
import path from 'path';
import snooplogg from 'snooplogg';
import { spawnSync } from 'child_process';

const logger = snooplogg.config({
	minBrightness: 80,
	maxBrightness: 210,
	theme: 'detailed'
})('test');
const { log } = logger;
const { highlight } = snooplogg.styles;

const axwayBin = path.resolve(__dirname, `../packages/axway-cli/${process.env.APPCD_COVERAGE ? 'src' : 'dist'}/main.js`);

const defaultVars = {
	version: '(?:\\d\\.\\d\\.\\d(?:-[^\\s]*)?)',
	year: (new Date()).getFullYear()
};
for (const fn of [ 'blue', 'cyan', 'gray', 'green', 'magenta', 'red', 'yellow' ]) {
	defaultVars[fn] = () => {
		return (text, render) => chalk[fn](render(text)).replace(/(?<!\\)(\(|\)|\[|\])/g, '\\$1');
	}
}

export function renderRegex(str, vars) {
	str = str.replace(/(\(|\)|\[|\])/g, '\\$1');
	str = Mustache.render(str, Object.assign({}, defaultVars, vars));
	return new RegExp(str);
}

export function resetHomeDir() {
	// sanity check that we're not nuking the real home directory
	const homedir = os.homedir();
	if (homedir.startsWith(os.tmpdir())) {
		log(`Emptying temp home directory: ${highlight(homedir)}`);
		for (const name of fs.readdirSync(homedir)) {
			fs.removeSync(path.join(homedir, name));
		}
	} else {
		log(`Refusing to empty home directory! ${highlight(homedir)}`);
	}
}

export function runAxwaySync(args = [], opts = {},  cfg) {
	const env = Object.assign({}, process.env, opts.env);
	if (env.APPCD_TEST) {
		if (args.includes('--no-color') || args.includes('--no-colors')) {
			delete env.FORCE_COLOR;
		}
		delete env.SNOOPLOGG;
	}

	if (cfg) {
		args.unshift('--config', JSON.stringify(cfg));
	}

	log(`Executing: ${highlight(`${process.execPath} ${axwayBin} ${args.join(' ')}`)}`);
	const result = spawnSync(process.execPath, [ axwayBin, ...args ], {
		ignoreExitCodes: true,
		windowsHide: true,
		...opts,
		env
	});

	logger('stdout').log(result.stdout.toString());
	logger('stderr').log(result.stderr.toString());
	log(`Process exited (code ${result.status})`);

	return result;
}

export function startServer() {
	//
}

export function stopServer() {
	//
}
