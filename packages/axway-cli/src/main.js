/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import check from 'check-kit';
import CLI, { chalk } from 'cli-kit';
import {
	createRequestOptions,
	createTable,
	hlVer,
	loadConfig,
	locations,
	telemetry
} from '@axway/amplify-cli-utils';
import { dirname, join, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';

const { bold, cyan, gray, red, yellow } = chalk;

(async () => {
	const pkgJson = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json')));
	const { version } = pkgJson;
	process.env.AMPLIFY_CLI = version;
	process.env.AXWAY_CLI = version;

	const cfg = loadConfig();

	const externalExtensions = Object.entries(cfg.get('extensions', {}));
	const allExtensions = [ ...externalExtensions ];
	for (const name of [ '@axway/amplify-cli-auth', '@axway/axway-cli-oum', '@axway/axway-cli-pm' ]) {
		allExtensions.push([ name, dirname(dirname(require.resolve(name))) ]);
	}

	const packagesDir = resolve(locations.axwayHome, 'axway-cli', 'packages');

	let checkWait;

	let banner = `${cyan('AXWAY CLI')}, version ${version}
Copyright (c) 2018-2021, Axway, Inc. All Rights Reserved.`;

	if (process.versions.node.split('.')[0] < 12) {
		banner += '\n\n' + yellow(` ┃ ATTENTION! The Node.js version you are currently using (${process.version}) has been
 ┃ deprecated and is unsupported in Axway CLI v3 and newer. Please upgrade
 ┃ Node.js to the latest LTS release: https://nodejs.org/`);
	}

	const { arch } = process;
	if (arch === 'ia32' || arch === 'x32') {
		// TODO: remove this in 3.0.0
		banner += '\n\n' + yellow(` ┃ ATTENTION! Your current architecture "${arch}" has been deprecated and is unsupported
 ┃ in Axway CLI v3 and newer.`);
	} else if (arch !== 'x64') {
		banner += '\n\n' + yellow(` ┃ ATTENTION! Your current architecture "${arch}" is not supported.`);
	}

	const cli = new CLI({
		banner,
		commands:         `${__dirname}/commands`,
		desc:             'The Axway CLI is a unified command line interface for the Axway Amplify Platform.',
		extensions:       allExtensions.map(ext => ext[1]),
		help:             true,
		helpExitCode:     2,
		helpTemplateFile: resolve(__dirname, '../templates/help.tpl'),
		name:             'axway',
		version
	});

	cli.on('banner', () => {
		if (cfg.get('update.check') === false) {
			return;
		}

		const opts = createRequestOptions({
			metaDir: resolve(locations.axwayHome, 'axway-cli', 'update'),
			timeout: 4000
		}, cfg);

		// store the check promise and let it continue asynchronously
		checkWait = Promise.all([
			// check the Axway CLI for updates
			check({
				...opts,
				pkg: pkgJson
			}).catch(() => {}),

			// check all CLI extensions for updates
			...(externalExtensions
				.map(ext => join(ext[1], 'package.json'))
				.filter(ext => ext.startsWith(packagesDir) && existsSync(ext))
				.map(pkg => check({
					...opts,
					pkg
				}).catch(() => {})))
		]);
	});

	// initialize the telemetry instance in amplify-cli-utils
	telemetry.init({
		appGuid: '1d99561b-8770-428c-84b2-5bef95ce263d',
		appVersion: version
	});

	// local ref so we can include argv and the context chain in the crash report
	let state;

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

		telemetry.addEvent({
			argv: state._argv.slice(0),
			duration: longRunning ? undefined : Date.now() - state.startTime,
			event: [ 'cli', ...state.contexts.map(ctx => ctx.name).reverse().slice(1) ].join('.'),
			extensions: allExtensions
				.map(([ name, ext ]) => {
					const info = { name };
					try {
						const json = JSON.parse(readFileSync(join(ext, 'package.json')));
						if (ext.startsWith(packagesDir)) {
							info.managed = true;
						}
						info.version = json.version;
					} catch (err) {
						//
					}
					return info;
				})
		});
	});

	try {
		// execute the command
		const { cmd, console } = await cli.exec();

		// now that the command is done, wait for the check to finish and display it's message,
		// if there is one
		if (checkWait && cmd.prop('banner')) {
			const results = (await checkWait).filter(p => p?.updateAvailable);
			if (results.length) {
				const boxen = require('boxen');
				let msg = '';
				let axway = '';
				const exts = createTable();
				const ts = cfg.get('update.notified');

				// only show update notifications once every half hour
				if (ts && (Date.now() - ts) < (30 * 60 * 1000)) {
					return;
				}

				loadConfig().set('update.notified', Date.now()).save();

				// remove axway package and treat it special
				for (let i = 0; i < results.length; i++) {
					if (results[i].name === 'axway') {
						axway += yellow('Axway CLI Update Available'.toUpperCase()) + '\n';
						axway += `${bold('Axway CLI')} ${gray(results[i].current)} →  ${hlVer(results[i].latest, results[i].current)}\n`;
						axway += `Run ${cyan('npm i -g axway')} to update`;
						results.splice(i--, 1);
					} else {
						exts.push([ bold(results[i].name), gray(results[i].current), '→', hlVer(results[i].latest, results[i].current) ]);
					}
				}

				if (axway) {
					msg += axway;
				}
				if (exts.length && !cmd.skipExtensionUpdateCheck) {
					msg += `${axway ? '\n\n' : ''}${yellow(`Package Update${results.length > 1 ? 's' : ''} Available`.toUpperCase())}\n${exts.toString()}\nRun ${cyan('axway pm update')} to update`;
				}

				if (msg) {
					console.log('\n' + boxen(msg, {
						align: 'center',
						borderColor: 'yellow',
						borderStyle: 'round',
						margin: { bottom: 1, left: 4, right: 4, top: 1 },
						padding: { bottom: 1, left: 4, right: 4, top: 1 }
					}));
				}
			}
		}
	} catch (err) {
		const exitCode = err.exitCode || 1;

		// record the crash
		telemetry.addCrash({
			message: err.toString(),
			stack: err.stack,
			argv: state?._argv.slice(0),
			contexts: state?.contexts.map(ctx => ctx.name),
			duration: state ? Date.now() - state.startTime : 0
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
				console.error(line ? red(`  ${line}`) : '');
			}
			if (err.detail) {
				console.error('');
				for (const line of String(err.detail).split(/\r\n|\n/)) {
					console.error(red(`  ${line}`));
				}
			}
		}

		process.exit(exitCode);
	}
})();
