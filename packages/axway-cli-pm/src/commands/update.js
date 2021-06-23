export default {
	aliases: [ 'up' ],
	args: [
		{
			name: 'package',
			desc: 'The package name to update'
		}
	],
	desc: 'Download updates for installed packages',
	options: {
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs updated packages as JSON'
		},
		'-y, --yes': {
			aliases: [ '--no-prompt' ],
			desc: 'Automatic yes to prompts and run non-interactively'
		}
	},
	async action({ argv, cli, console, exitCode, terminal }) {
		const { default: snooplogg }                      = require('snooplogg');
		const { hlVer, runListr }                         = require('../utils');
		const { createTable, loadConfig }                 = require('@axway/amplify-cli-utils');
		const { find, install, list, listPurgable, view } = require('../pm');
		const ora                                         = require('ora');
		const promiseLimit                                = require('promise-limit');
		const semver                                      = require('semver');

		const { alert, bold, highlight } = snooplogg.styles;
		const results = {
			alreadyActive: [],
			selected: [],
			installed: [],
			failures: []
		};
		let packages = [];

		// get installed packages
		if (argv.package) {
			const pkg = await find(argv.package);
			if (!pkg) {
				throw new Error(`Package "${argv.package}" is not installed`);
			}
			packages.push(pkg);
		} else {
			packages = await list();
		}

		if (!packages.length) {
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
		await Promise.all(packages.map(pkg => {
			return plimit(async () => {
				pkg.current = Object.keys(pkg.versions).sort(semver.rcompare)[0];
				pkg.latest = (await view(pkg.name)).version;
			});
		}));
		spinner.stop();

		// step 2: confirm updates
		const updateTable = createTable();
		for (let i = 0; i < packages.length; i++) {
			const pkg = packages[i];
			if (semver.gt(pkg.latest, pkg.version)) {
				updateTable.push([ bold(`  ${pkg.name}`), pkg.version, '→', hlVer(pkg.latest, pkg.version) ]);
			} else {
				results.alreadyActive.push(`${pkg.name}@${pkg.version}`);
				packages.splice(i--, 1);
			}
		}
		if (!packages.length) {
			console.log('All packages are up-to-date');
			return;
		}
		console.log('The following packages have updates available:');
		console.log(updateTable.toString());
		console.log();

		if (terminal.stdout.isTTY && !argv.yes) {
			await new Promise(resolve => {
				terminal.once('keypress', str => {
					terminal.stderr.cursorTo(0);
					terminal.stderr.clearLine();
					if (str === 'y' || str === 'Y') {
						return resolve();
					}
					process.exit(0);
				});
				terminal.stderr.write('Do you want to update? (y/N) ');
			});
		}

		// step 3: create the tasks
		const tasks = packages.map(pkg => {
			const versionData = pkg.versions[pkg.latest];
			if (versionData) {
				// select it
				return {
					title: `${highlight(`${pkg.name}@${pkg.latest}`)} is installed, setting it as active`,
					async task(ctx, task) {
						results.selected.push(`${pkg.name}@${pkg.latest}`);
						const cfg = loadConfig();
						cfg.set(`extensions.${pkg.name}`, versionData.path);
						cfg.save();
						task._task.title = `${highlight(`${pkg.name}@${pkg.latest}`)} set as active version`;
					}
				};
			}

			return {
				title: `Downloading and installing ${highlight(`${pkg.name}@${pkg.latest}`)}`,
				async task(ctx, task) {
					try {
						await new Promise((resolve, reject) => {
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
									task._task.title = `${highlight(`${info.name}@${info.version}`)} installed and set as active version`;
									results.installed.push(info);
									resolve();
								})
								.on('error', reject);
						});
					} catch (err) {
						results.failures.push({
							error: err.toString(),
							package: pkg
						});
						task._task.title = alert(err.toString());
						err.message = undefined; // prevent the error from rendering twice
						exitCode(1);
						throw err;
					}
				}
			};
		});

		// step 4: run the tasks
		try {
			await runListr({ console, json: argv.json, tasks });
		} catch (err) {
			// errors are stored in the results
		}

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const purgable = await listPurgable(argv.package);
			if (Object.keys(purgable).length) {
				console.log(`\nThe following package versions can be purged by running: ${highlight('"axway pm purge"')}`);
				const purgeTable = createTable();
				for (const [ name, versions ] of Object.entries(purgable)) {
					purgeTable.push([ `  ${bold(name)}`, highlight(versions.map(v => v.version).join(', ')) ]);
				}
				console.log(purgeTable.toString());
			}
		}

		await cli.emitAction('axway:pm:update', results);
	}
};
