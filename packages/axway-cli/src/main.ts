import check, {
	CheckKitOptions,
	CheckKitResults
} from 'check-kit';
import {
	CLI,
	CLIContext,
	CLINextIterator,
	CLIParsedArgument,
	CLIState
} from 'cli-kit';
import {
	AxwayCLIState,
	Config,
	createRequestOptions,
	createTable,
	environments,
	hlVer,
	loadConfig,
	locations,
	telemetry
} from '@axway/amplify-cli-utils';
import path from 'path';
import snooplogg from 'snooplogg';
import { dirname, join, parse, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { redact } from '@axway/amplify-utils';
import { serializeError } from 'serialize-error';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { bold, cyan, gray, red, yellow } = snooplogg.styles;
const { log, warn } = snooplogg('axway');

type ConfigExtension = [ string, string ];

(async () => {
	const pkgJson = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8'));
	const { version } = pkgJson;
	process.env.AMPLIFY_CLI = version;
	process.env.AXWAY_CLI = version;

	let cfg: Config;
	try {
		cfg = await loadConfig();
	} catch (err) {
		// config failed to load, reset to defaults
		warn(err);
		cfg = await new Config().init();
	}

	const externalExtensions: ConfigExtension[] = [] // Object.entries(cfg.get('extensions', {}));
	const allExtensions: ConfigExtension[] = [ ...externalExtensions ];
	// for (const name of [ '@axway/axway-cli-auth', '@axway/axway-cli-oum', '@axway/axway-cli-pm' ]) {
	// 	let { dir, root } = parse(__dirname);
	// 	while (dir !== root) {
	// 		const packageDir = resolve(dir, 'node_modules', name);
	// 		const pkgJson = join(packageDir, 'package.json');
	// 		if (existsSync(pkgJson)) {
	// 			allExtensions.push([ name, packageDir ]);
	// 			break;
	// 		}
	// 		dir = dirname(dir);
	// 	}
	// }

	const packagesDir = resolve(locations.axwayHome, 'axway-cli', 'packages');
	let checkWait: Promise<(CheckKitResults | void)[]> | undefined;

	console.log(CLI);
	const cli = new CLI({
		banner() {
			const env = process.env.AXWAY_ENV;
			const title = process.env.AXWAY_ENV_TITLE;
			let str = `${cyan('AXWAY CLI')}, version ${version}${!env || env === 'prod' || !title ? '' : ` ${yellow(title.toUpperCase())}`}
Copyright (c) 2018-2022, Axway, Inc. All Rights Reserved.`;

			if (parseInt(process.versions.node.split('.')[0]) < 14) {
				str += '\n\n' + yellow(` ┃ ATTENTION! The Node.js version you are currently using (${process.version}) has been
 ┃ deprecated and is unsupported in Axway CLI v4 and newer. Please upgrade
 ┃ Node.js to the latest LTS release: https://nodejs.org/`);
			}

			const { arch } = process;
			if (arch !== 'x64' && arch !== 'arm64') {
				str += '\n\n' + yellow(` ┃ ATTENTION! Your current architecture "${arch}" is not supported.`);
			}
			return str;
		},
		commands:         `${__dirname}/commands`,
		desc:             'The Axway CLI is a unified command line interface for the Axway Amplify Platform.',
		extensions:       allExtensions.map(ext => ext[1]),
		help:             true,
		helpExitCode:     2,
		helpTemplateFile: resolve(__dirname, '../templates/help.tpl'),
		name:             'axway',
		options: {
			'--env [name]': { hidden: true, redact: false }
		},
		version
	});

	cli.on('banner', async ({ argv }) => {
		if (cfg.get('update.check') === false || argv.json) {
			log('Skipping update check');
			return;
		}

		const opts = await createRequestOptions({
			timeout: { request: 4000 }
		}, cfg);

		const checkOpts: CheckKitOptions = {
			caFile:    opts.caFile,
			certFile:  opts.certFile,
			keyFile:   opts.keyFile,
			proxy:     opts.proxy,
			strictSSL: opts.strictSSL,
			timeout:   opts.timeout,
			metaDir:   resolve(locations.axwayHome, 'axway-cli', 'update'),
			pkg:       pkgJson
		};

		// store the check promise and let it continue asynchronously
		checkWait = Promise.all<CheckKitResults | void>([
			// check the Axway CLI for updates
			check({
				caFile:    opts.caFile,
				certFile:  opts.certFile,
				keyFile:   opts.keyFile,
				proxy:     opts.proxy,
				strictSSL: opts.strictSSL,
				timeout:   opts.timeout,
				metaDir:   resolve(locations.axwayHome, 'axway-cli', 'update'),
				pkg:       pkgJson
			}).catch(() => {}),

					// check all CLI extensions for updates
			...(externalExtensions
				.map(ext => join(ext[1], 'package.json'))
				.filter(ext => ext.startsWith(packagesDir) && existsSync(ext))
				.map(async (pkg): Promise<CheckKitResults | void> => {
					try {
						return await check(Object.assign(checkOpts, { pkg }));
					} catch (e: any) {}
				})
			)
		]);
	});

	// initialize the telemetry instance in amplify-cli-utils
	telemetry.init({
		appGuid: '0049ef76-0557-4b83-985c-a1d29c280227',
		appVersion: version
	});

	// local ref so we can include argv and the context chain in the crash report
	let state: AxwayCLIState | undefined = undefined;

	// after the args have been parsed, determine the environment before the banner is rendered
	cli.on('parse', async (state: CLIState, next: CLINextIterator) => {
		const { result } = await next();
		const env = environments.resolve(result.argv.env || cfg.get('env'));
		process.env.AXWAY_ENV = env.name;
		process.env.AXWAY_ENV_TITLE = env.title;
	});

	// add the hook to record the telemetry event after the command finishes running
	cli.on('exec', async (_state, next) => {
		state = _state as AxwayCLIState;
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
			telemetry.addCrash({
				message: 'Unknown error',
				...serializeError(state.err),
				argv:     scrubArgv(state.__argv),
				contexts,
				duration: Date.now() - state.startTime,
				exitCode: state.exitCode() || 0,
				warnings: state.warnings
			});
		} else {
			telemetry.addEvent({
				argv:       scrubArgv(state.__argv),
				contexts,
				duration:   longRunning ? undefined : Date.now() - state.startTime,
				event:      contexts.length ? [ 'cli', ...contexts.slice(1) ].join('.') : 'cli.exec',
				exitCode:   state?.exitCode() || 0,
				extensions: allExtensions
					.map(([ name, ext ]) => {
						const info = {
							err: undefined,
							managed: false,
							name,
							version: undefined
						};
						try {
							const json = JSON.parse(readFileSync(join(ext, 'package.json'), 'utf-8'));
							if (ext.startsWith(packagesDir)) {
								info.managed = true;
							}
							info.version = json.version;
						} catch (err: any) {
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
		if (checkWait && cmd.prop('banner')) {
			const results: CheckKitResults[] = (await checkWait).filter(p => p?.updateAvailable) as CheckKitResults[];
			if (results.length) {
				const { default: boxen } = await import('boxen');
				let msg = '';
				let axway = '';
				const exts = createTable();
				const ts = cfg.get('update.notified');

				// only show update notifications once every hour
				if (ts && (Date.now() - ts) < 3600000) {
					return;
				}

				const config = await loadConfig();
				await config.set('update.notified', Date.now());
				await config.save();

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
	} catch (err: any) {
		const exitCode = err.exitCode || 1;

		// record the crash
		telemetry.addCrash({
			message: 'Unknown error',
			...serializeError(err),
			argv:     state ? scrubArgv((state as AxwayCLIState).__argv) : undefined,
			contexts: state ? (state as AxwayCLIState).contexts.map((ctx: CLIContext) => ctx.name).reverse() : undefined,
			duration: state ? Date.now() - (state as AxwayCLIState).startTime : undefined,
			exitCode: state ? (state as AxwayCLIState).exitCode() : 0,
			warnings: state ? (state as AxwayCLIState).warnings : undefined
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

		process.exit(exitCode);
	}
})();

/**
 * Redacts potentially sensitive command line args.
 *
 * @param {Array<Object>} argv - The parsed arguments.
 * @returns {Array<String>}
 */
function scrubArgv(argv: CLIParsedArgument[]): string[] {
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
