import bodyParser from 'koa-bodyparser';
import callerPath from 'caller-path';
import chalk from 'chalk';
import fs from 'fs-extra';
import Koa from 'koa';
import Mustache from 'mustache';
import os from 'os';
import path from 'path';
import Router from '@koa/router';
import snooplogg from 'snooplogg';
import { createAuthRoutes } from './auth-routes';
import { createPlatformRoutes } from './platform-routes';
import { spawn, spawnSync } from 'child_process';

const logger = snooplogg.config({
	minBrightness: 80,
	maxBrightness: 210,
	theme: 'detailed'
})('test');
const { log } = logger;
const { highlight } = snooplogg.styles;

const axwayBin = path.resolve(__dirname, `../../packages/axway-cli/${process.env.APPCD_COVERAGE ? 'src' : 'dist'}/main.js`);

export function initHomeDir(templateDir) {
	if (!fs.existsSync(templateDir) && !path.isAbsolute(templateDir)) {
		templateDir = path.resolve(path.dirname(callerPath()), templateDir);
	}

	const homeDir = path.join(os.homedir(), '.axway', 'axway-cli');
	log(`Copying ${highlight(templateDir)} => ${highlight(homeDir)}`);
	fs.copySync(templateDir, homeDir);
}

const defaultVars = {
	delta: '\\d+(\\.\\d+)?\\w( \\d+(\\.\\d+)?\\w)*',
	url: 'http[^\\s]+',
	version: '(?:\\d\\.\\d\\.\\d(?:-[^\\s]*)?)',
	x: process.platform === 'win32' ? 'x' : '✖',
	year: (new Date()).getFullYear()
};
for (const fn of [ 'blue', 'cyan', 'gray', 'green', 'magenta', 'red', 'yellow' ]) {
	defaultVars[fn] = () => {
		return (text, render) => {
			return chalk[fn]('8675309')
				.replace(/(?<!\\)([()[\]?])/g, '\\$1')
				.replace('8675309', render(text));
		};
	}
}

export function renderRegex(str, vars) {
	str = str.replace(/([()[\]?])/g, '\\$1');
	str = Mustache.render(str, Object.assign({}, defaultVars, vars));
	return new RegExp(str);
}

export function renderRegexFromFile(file) {
	if (!fs.existsSync(file) && !/\.mustache$/.test(file)) {
		file += '.mustache';
	}
	if (!fs.existsSync(file) && !path.isAbsolute(file)) {
		file = path.resolve(path.dirname(callerPath()), file);
	}
	return renderRegex(fs.readFileSync(file, 'utf8'));
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

function _runAxway(fn, args = [], opts = {},  cfg) {
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

	args.unshift(axwayBin);

	if (opts.passiveOpen) {
		args.unshift('--require', path.join(__dirname, 'open-shim-passive.js'));
	} else {
		args.unshift('--require', path.join(__dirname, 'open-shim.js'));
	}

	log(`Executing: ${highlight(`${process.execPath} ${axwayBin} ${args.join(' ')}`)}`);
	return fn(process.execPath, args, {
		ignoreExitCodes: true,
		windowsHide: true,
		...opts,
		env
	});
}

export function runAxway(args = [], opts = {},  cfg) {
	return _runAxway(spawn, args, opts, cfg);
}

export function runAxwaySync(args = [], opts = {},  cfg) {
	const child = _runAxway(spawn, args, opts, cfg);
	let stdout = '';
	let stderr = '';
	child.stdout.on('data', s => {
		stdout += s.toString();
		if (process.env.ECHO_CHILD) {
			process.stdout.write(s.toString());
		}
		log(s.toString().trim());
	});
	child.stderr.on('data', s => {
		stderr += s.toString();
		if (process.env.ECHO_CHILD) {
			process.stderr.write(s.toString());
		}
		log(s.toString().trim());
	});
	return new Promise((resolve, reject) => child.on('close', status => {
		log(`Process exited (code ${status})`);
		resolve({ status, stdout, stderr });
	}));
}

// export function runAxwaySync(args = [], opts = {},  cfg) {
// 	const result = _runAxway(spawnSync, args, opts, cfg);
// 	logger('stdout').log(result.stdout.toString());
// 	logger('stderr').log(result.stderr.toString());
// 	if (process.env.ECHO_CHILD) {
// 		process.stdout.write(result.stdout.toString());
// 		process.stderr.write(result.stderr.toString());
// 	}
// 	log(`Process exited (code ${result.status})`);
// 	return result;
// }

function createServer({ port }) {
	return new Promise((resolve, reject) => {
		const app = new Koa();
		const router = new Router();

		app.use(bodyParser());
		app.use(async (ctx, next) => {
			log(`Incoming request: ${highlight(`${ctx.method} ${ctx.url}`)}`);
			await next();
		});
		app.use(router.routes())


		const server = app.listen(port, '127.0.0.1');
		server.__connections = {};
		server.router = router;

		server.on('connection', conn => {
			const key = conn.remoteAddress + ':' + conn.remotePort;
			log(`${highlight(key)} connected`);
			server.__connections[key] = conn;
			conn.on('close', () => {
				delete server.__connections[key];
				log(`${highlight(key)} disconnected`);
			});
		});
		server.on('listening', () => {
			log(`Started test server: http://127.0.0.1:${port}`);
			resolve(server);
		});
		server.on('error', reject);
	});
}

export async function startAuthServer(opts = {}) {
	const server = await createServer({ port: 8555 });
	await createAuthRoutes(server, opts);
	return server;
}

export async function startPlatformServer(opts = {}) {
	const server = await createServer({ port: 8666 });
	await createPlatformRoutes(server, opts);
	return server;
}

export async function startServers() {
	const state = {};
	return [
		await startAuthServer({ state }),
		await startPlatformServer({ state })
	];
}

export async function stopServers() {
	this.timeout(10000);

	// we need to wait 1 second because after logging in, the browser is redirect to platform and
	// even though this is a test, we should avoid the browser erroring because we killed the
	// server too soon
	await new Promise(resolve => setTimeout(resolve, 1000));

	if (this.servers) {
		log(`Stopping ${this.servers.length} server${this.servers.length === 1 ? '' : 's'}...`);
		for (const server of this.servers) {
			for (const conn of Object.values(server.__connections)) {
				conn.destroy();
			}
			await new Promise(resolve => server.close(resolve));
		}
		this.servers = null;
	}
}

export function stripColors(s) {
	return s.replace(/\x1B\[\d+m/g, '');
}
