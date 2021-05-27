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
		}
	},
	async action({ argv, cli, console, exitCode }) {
		const { default: snooplogg }        = require('snooplogg');
		const { loadConfig }                = require('@axway/amplify-cli-utils');
		const { runListr }                  = require('../utils');
		const { find, install, list, view } = require('../pm');

		const { alert, highlight } = snooplogg.styles;
		const cfg = loadConfig();
		let packages = [];
		const results = {
			alreadyActive: [],
			selected: [],
			installed: [],
			failures: []
		};
		const tasks = [];

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

		for (const pkg of packages) {
			tasks.push({
				title: `Checking ${highlight(pkg.name)}`,
				async task(ctx, task) {
					const info = await view(pkg.name);

					if (pkg.version === info.version) {
						task._task.title = `${highlight(`${pkg.name}@${info.version}`)} is already up-to-date`;
						results.alreadyActive.push(`${pkg.name}@${info.version}`);
						return;
					}

					if (Object.keys(pkg.versions).includes(info.version)) {
						const versionData = pkg.versions[info.version];
						task.title = `${highlight(`${pkg.name}@${info.version}`)} is installed, setting it as active`;
						results.selected.push(`${pkg.name}@${info.version}`);
						cfg.set(`extensions.${pkg.name}`, versionData.path);
						cfg.save();
						task._task.title = `${highlight(`${pkg.name}@${info.version}`)} set as active version`;
						return;
					}

					task.title = `Downloading and installing ${highlight(`${pkg.name}@${info.version}`)}`;
					results.installed.push(`${pkg.name}@${info.version}`);

					try {
						await new Promise((resolve, reject) => {
							install(`${pkg.name}@${info.version}`)
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
									task._task.title = `Installed ${highlight(`${info.name}@${info.version}`)}`;
									results.installed.push(info);
									resolve();
								})
								.on('error', reject);
						});

						task._task.title = `${highlight(`${pkg.name}@${info.version}`)} updated and set as active version`;
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
			});
		}

		try {
			await runListr({ console, json: argv.json, tasks });
		} catch (err) {
			// errors are stored in the results
		}

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		}

		await cli.emitAction('axway:pm:update', results);
	}
};
