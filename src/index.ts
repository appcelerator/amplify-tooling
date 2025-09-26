import check from 'check-kit';
import CLI from 'cli-kit';
import * as telemetry from './lib/telemetry.js';
import loadConfig, { Config } from './lib/config.js';
import snooplogg from 'snooplogg';
import { createRequestOptions } from './lib/request.js';
import { axwayHome } from './lib/path.js';
import { redact } from './lib/redact.js';
import * as environments from './lib/environments.js';

import { dirname, join, resolve } from 'path';
import { readFileSync } from 'fs';
import { serializeError } from 'serialize-error';
import { fileURLToPath } from 'url';
import boxen from 'boxen';

const { bold, cyan, gray, red, yellow } = snooplogg.styles;
const { log, warn } = snooplogg('axway');
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

(async () => {
	const pkgJson = JSON.parse(String(readFileSync(resolve(__dirname, '..', 'package.json'))));
	const { version } = pkgJson;
	process.env.AMPLIFY_CLI = version;
	process.env.AXWAY_CLI = version;

	let cfg;
	try {
		cfg = await loadConfig();
	} catch (err) {
		// config failed to load, reset to defaults
		warn(err);
		cfg = await new Config().init();
	}
	const allExtensions: [ string, string ][] = Object.entries(cfg.get('extensions', {}));

	const packagesDir = resolve(axwayHome, 'axway-cli', 'packages');
	let checkWait;

	const cli = new CLI({
		banner() {
			const env = process.env.AXWAY_ENV;
			const title = process.env.AXWAY_ENV_TITLE;
			const year = new Date(Date.now()).getFullYear().toString();
			let str = `${cyan('AXWAY CLI')}, version ${version}${!env || env === 'prod' ? '' : ` ${yellow(title.toUpperCase())}`}
Copyright (c) 2018-${year}, Axway, Inc. All Rights Reserved.`;

			if (Number(process.versions.node.split('.')[0]) < 20) {
				str += '\n\n' + yellow(` ┃ ATTENTION! The Node.js version you are currently using (${process.version}) has been
 ┃ deprecated and is unsupported in Axway CLI v5 and newer. Please upgrade
 ┃ Node.js to the latest LTS release: https://nodejs.org/`);
			}

			const { arch } = process;
			if (arch === 'ia32') {
				str += '\n\n' + yellow(` ┃ ATTENTION! Your current architecture "${arch}" has been deprecated and is unsupported
 ┃ in Axway CLI v3 and newer.`);
			} else if (arch !== 'x64' && arch !== 'arm64') {
				str += '\n\n' + yellow(` ┃ ATTENTION! Your current architecture "${arch}" is not supported.`);
			}
			return str;
		},
		commands:         `${__dirname}/commands`,
		desc:             'The Axway CLI is a unified command line interface for the Axway Amplify Platform.',
		extensions:       allExtensions.map(ext => ext[1]),
		help:             true,
		helpExitCode:     2,
		name:             'axway',
		options: {
			'--env [name]': { hidden: true, redact: false }
		},
		version
	});

	cli.on('banner', async ({ argv }) => {
		if (await cfg.get('update.check') === false || argv.json) {
			log('Skipping update check');
			return;
		}

		// store the check promise and let it continue asynchronously
		checkWait = check({
			...createRequestOptions({
				metaDir: resolve(axwayHome, 'axway-cli', 'update'),
				timeout: 4000
			}, cfg),
			pkg: pkgJson
		}).catch(() => {});
	});

	// initialize the telemetry instance for the Axway CLI
	telemetry.init({
		appGuid: '0049ef76-0557-4b83-985c-a1d29c280227',
		appVersion: version,
		config: cfg
	});

	// local ref so we can include argv and the context chain in the crash report
	let state;

	// after the args have been parsed, determine the environment before the banner is rendered
	cli.on('parse', async (_state, next) => {
		const { result } = await next();
		const env = environments.resolve(result.argv.env || cfg.get('env'));
		process.env.AXWAY_ENV = env.name;
		process.env.AXWAY_ENV_TITLE = env.title;
	});

	// add the hook to record the telemetry event after the command finishes running
	cli.on('exec', async (_state, next) => {
		state = _state;
		state.startTime = Date.now();

		// if the command is running, then don't wait for it to finish, just send the telemetry
		// data now
		const longRunning = state.cmd.prop('longRunning');
		if (!longRunning) {
			await next();
		}

		const contexts = state.contexts.map(ctx => ctx.name).reverse();

		if (state?.err) {
			// an error occurred and the help screen was displayed instead of being thrown
			await telemetry.addCrash({
				message: 'Unknown error',
				...serializeError(state.err),
				argv:     scrubArgv(state.__argv),
				contexts,
				duration: Date.now() - state.startTime,
				exitCode: state.exitCode() || 0,
				warnings: state.warnings
			});
		} else {
			await telemetry.addEvent({
				argv:       scrubArgv(state.__argv),
				contexts,
				duration:   longRunning ? undefined : Date.now() - state.startTime,
				event:      `telemetry.${contexts.length ? [ 'cli', ...contexts.slice(1) ].join('.') : 'cli.exec'}`,
				exitCode:   state?.exitCode() || 0,
				extensions: allExtensions
					.map(([ name, ext ]) => {
						interface Info {
							name: string,
							managed: boolean,
							version: string,
							err: string
						}
						const info = { name } as Info;
						try {
							const json = JSON.parse(String(readFileSync(join(ext, 'package.json'))));
							if (ext.startsWith(packagesDir)) {
								info.managed = true;
							}
							info.version = json.version;
						} catch (err) {
							info.err = err.toString();
						}
						return info;
					}),
				warnings: state.warnings
			});
		}
	});

	try {
		// execute the command
		const { cmd, console } = await cli.exec();

		// now that the command is done, wait for the check to finish and display it's message,
		// if there is one
		const result = await checkWait;
		if (result?.updateAvailable && cmd.prop('banner')) {
			let msg = '';
			const ts = cfg.get('update.notified');

			// only show update notifications once every hour
			if (ts && (Date.now() - ts) < 3600000) {
				return;
			}
			const config = await loadConfig();
			await config.set('update.notified', Date.now());
			await config.save();

			msg += yellow('Axway CLI Update Available'.toUpperCase()) + '\n';
			msg += `${bold('Axway CLI')} ${gray(result.current)} →  ${_hlVer(result.latest, result.current)}\n`;
			msg += `Run ${cyan('npm i -g axway')} to update`;

			console.log('\n' + boxen(msg, {
				align: 'center',
				borderColor: 'yellow',
				borderStyle: 'round',
				margin: { bottom: 1, left: 4, right: 4, top: 1 },
				padding: { bottom: 1, left: 4, right: 4, top: 1 }
			}));
		}
	} catch (err) {
		const exitCode = err.exitCode || 1;

		// record the crash
		await telemetry.addCrash({
			message: 'Unknown error',
			...serializeError(err),
			argv:     state ? scrubArgv(state.__argv) : undefined,
			contexts: state ? state.contexts.map(ctx => ctx.name).reverse() : undefined,
			duration: state ? Date.now() - state.startTime : undefined,
			exitCode: state?.exitCode() || 0,
			warnings: state?.warnings
		});

		if (err.json) {
			console.log(JSON.stringify({
				code: exitCode,
				result: err.toString(),
				detail: err.detail
			}, null, 2));
		} else {
			const msg = `${process.platform === 'win32' ? 'x' : '✖'} ${err}`;
			for (let line of msg.split(/\r\n|\n/)) {
				line = line.trim();
				console.error(line ? red(line) : '');
			}
			if (err.detail) {
				console.error('');
				for (const line of String(err.detail).split(/\r\n|\n/)) {
					console.error(red(line));
				}
			}
		}

		process.exitCode = exitCode;
	}
})();

/**
 * Redacts potentially sensitive command line args.
 *
 * @param {Array<Object>} argv - The parsed arguments.
 * @returns {Array<String>}
 */
function scrubArgv(argv) {
	const scrubbed = [];
	for (const { arg, input, option, type } of argv) {
		if (type === 'command' || type === 'extension' || (type === 'option' && option.isFlag)) {
			scrubbed.push(...input);
		} else if (type === 'option') {
			scrubbed.push(...input.slice(0, 1).concat(input.slice(1).map(s => {
				return option.redact === false ? redact(s) : '<VALUE>';
			})));
		} else if (type === 'extra') {
			scrubbed.push(...input.slice(0, 1).concat(input.slice(1).map(() => '<VALUE>')));
		} else if (type === 'argument') {
			scrubbed.push(...input.map(s => {
				return arg && arg.redact === false ? redact(s) : '<ARG>';
			}));
		} else {
			scrubbed.push('<UNKNOWN>');
		}
	}
	return scrubbed;
}

/**
 * Highlights the difference between two versions.
 *
 * @param {String} toVer - The latest version.
 * @param {String} fromVer - The current version.
 * @returns {String}
 */
function _hlVer(toVer, fromVer) {
	const { green } = snooplogg.styles;
	const version = [];

	let [ from, fromTag ] = fromVer.split(/-(.+)/);
	from = from.replace(/[^.\d]/g, '').split('.').map(x => parseInt(x));

	let [ to, toTag ] = toVer.split(/-(.+)/);
	const toMatch = to.match(/^([^\d]+)?(.+)$/);
	to = (toMatch ? toMatch[2] : to).split('.').map(x => parseInt(x));

	const tag = () => {
		if (toTag) {
			const toNum = toTag.match(/\d+$/);
			const fromNum = fromTag && fromTag.match(/\d+$/);
			if (fromNum && parseInt(fromNum[0]) >= parseInt(toNum)) {
				return `-${toTag}`;
			} else {
				return green(`-${toTag}`);
			}
		}
		return '';
	};

	while (to.length) {
		if (to[0] > from[0]) {
			if (version.length) {
				return (toMatch && toMatch[1] || '') + version.concat(green(to.join('.') + tag())).join('.');
			}
			return green((toMatch && toMatch[1] || '') + to.join('.') + tag());
		}
		version.push(to.shift());
		from.shift();
	}

	return (toMatch && toMatch[1] || '') + version.join('.') + tag();
}
