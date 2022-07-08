import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';
import { PackageData } from '../types.js';

interface ExtendedPackageData extends PackageData {
	current: string;
	latest: string;
}

export default {
	aliases: [ 'up' ],
	args: [
		{
			name: 'package',
			desc: 'The package name to update',
			redact: false
		}
	],
	desc: 'Download updates for installed packages',
	options: {
		'--json': {
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
			desc: 'Outputs updated packages as JSON'
		},
		'-y, --yes': {
			aliases: [ '--no-prompt' ],
			desc: 'Automatic yes to prompts and run non-interactively'
		}
	},
	skipExtensionUpdateCheck: true,
	async action({ argv, cli, console, exitCode, terminal }: AxwayCLIState): Promise<void> {
		const { default: snooplogg }                      = await import('snooplogg');
		const { runListr }                                = await import('../utils.js');
		const { createTable, hlVer, loadConfig }          = await import('@axway/amplify-cli-utils');
		const { find, install, list, listPurgable, view } = await import('../pm.js');
		const { default: ora }                            = await import('ora');
		const { default: promiseLimit }                   = await import('promise-limit');
		const { default: semver }                         = await import('semver');

		const { alert, bold, highlight } = snooplogg.styles;
		const results: {
			alreadyActive: string[],
			selected: string[],
			installed: string[],
			failures: { error: string, package: string }[]
		} = {
			alreadyActive: [],
			selected: [],
			installed: [],
			failures: []
		};
		let packageDatas: PackageData[] = [];

		// get installed packages
		if (argv.package) {
			const pkg: PackageData | undefined = await find(argv.package as string);
			if (!pkg) {
				throw new Error(`Package "${argv.package}" is not installed`);
			}
			packageDatas.push(pkg);
		} else {
			packageDatas = await list();
		}

		if (!packageDatas.length) {
			if (argv.json) {
				console.log(JSON.stringify(results, null, 2));
			} else {
				console.log('There are no packages to update.');
			}
			return;
		}

		// step 1: check for updates
		const plimit = promiseLimit(10);
		const spinner = ora({ stream: terminal.stderr }).start('Checking packages for updates');
		const packages: ExtendedPackageData[] = (await Promise.all<ExtendedPackageData>(packageDatas.map(async (pkg): Promise<ExtendedPackageData> => {
			return await plimit(async () => {
				let latest = null;
				try {
					latest = (await view(pkg.name)).version;
				} catch (e) {}
				return {
					...pkg,
					current: Object.keys(pkg.versions).sort(semver.rcompare)[0],
					latest
				};
			}) as ExtendedPackageData;
		}))).filter(p => p.latest);
		spinner.stop();

		const updateTable = createTable();
		for (let i = 0; i < packages.length; i++) {
			const pkg = packages[i];
			if (semver.gt(pkg.latest as string, pkg.version as string)) {
				updateTable.push([ `  ${bold(pkg.name)}`, pkg.version, '→', hlVer(pkg.latest as string, pkg.version as string) ]);
			} else {
				results.alreadyActive.push(`${pkg.name}@${pkg.version}`);
				packages.splice(i--, 1);
			}
		}
		if (!packages.length) {
			console.log('All packages are up-to-date');
			return;
		}

		// step 2: confirm updates
		console.log(`The following packages have updates available:\n\n${updateTable.toString()}\n`);

		if (terminal.stdout.isTTY && !argv.yes && !argv.json) {
			await new Promise<void>(resolve => {
				terminal.once('keypress', str => {
					terminal.stderr.cursorTo(0);
					terminal.stderr.clearLine(0);
					if (str === 'y' || str === 'Y') {
						return resolve();
					}
					process.exit(0);
				});
				terminal.stderr.write('Do you want to update? (y/N) ');
			});
		}

		// step 3: create the tasks
		const tasks: any[] = packages.reduce((list: any[], pkg: ExtendedPackageData): any[] => {
			const versionData = pkg.versions[pkg.latest];
			if (versionData) {
				// select it
				list.push({
					title: `${highlight(`${pkg.name}@${pkg.latest}`)} is installed, setting it as active`,
					async task(ctx: any, task: any) {
						results.selected.push(`${pkg.name}@${pkg.latest}`);
						const config = await loadConfig();
						await config.set(`extensions.${pkg.name}`, versionData.path);
						await config.save();
						task.title = `${highlight(`${pkg.name}@${pkg.latest}`)} set as active version`;
					}
				});
			} else {
				list.push({
					title: `Downloading and installing ${highlight(`${pkg.name}@${pkg.latest}`)}`,
					async task(ctx: any, task: any) {
						try {
							await new Promise<void>((resolve, reject) => {
								install(`${pkg.name}@${pkg.latest}`)
									.on('download', ({ name, version }) => {
										task.title = `Downloading ${highlight(`${name}@${version}`)}`;
									})
									.on('install', ({ name, version }) => {
										task.title = `Installing ${highlight(`${name}@${version}`)}`;
									})
									.on('register', ({ name, version }) => {
										task.title = `Registering ${highlight(`${name}@${version}`)}`;
									})
									.on('end', info => {
										task.title = `${highlight(`${info.name}@${info.version}`)} installed and set as active version`;
										results.installed.push(info);
										resolve();
									})
									.on('error', reject);
							});
						} catch (err: any) {
							results.failures.push({
								error: err.toString(),
								package: pkg.name
							});
							task.title = alert(err.toString());
							err.message = undefined; // prevent the error from rendering twice
							exitCode(1);
							throw err;
						}
					}
				});
			}

			return list;
		}, [] as any[]);

		// step 4: run the tasks
		try {
			await runListr({ console, json: !!argv.json, tasks });
		} catch (err: any) {
			// errors are stored in the results
		}

		const cfg = await loadConfig();
		cfg.delete('update.notified');
		await cfg.save();

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			// step 5: show packages that can be purged
			const purgable = await listPurgable(argv.package as string);
			if (Object.keys(purgable).length) {
				const purgeTable = createTable();
				for (const [ name, versions ] of Object.entries(purgable)) {
					purgeTable.push([ `  ${bold(name)}`, versions.map(v => v.version).sort(semver.rcompare).join(', ') ]);
				}
				console.log(`\nThe following package versions can be purged:\n\n${purgeTable.toString()}\n\nTo purge these unused packages, run: ${highlight('axway pm purge')}`);
			}
		}

		await cli.emitAction('axway:pm:update', results);
	}
};
