export default {
	aliases: [ 'i' ],
	args: [
		{
			name: 'packages...',
			hint: 'package[@version]',
			desc: 'One or more packages by name and version to install',
			redact: false,
			required: true
		}
	],
	desc: 'Install a package',
	options: {
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Output installed package as JSON'
		}
	},
	skipExtensionUpdateCheck: true,
	async action({ argv, cli, console, exitCode }) {
		const { default: snooplogg } = await import('snooplogg');
		const { Extension }          = await import('cli-kit');
		const { install }            = await import('../pm');
		const { loadConfig }         = await import('@axway/amplify-cli-utils');
		const { runListr }           = await import('../utils');

		const { alert, highlight } = snooplogg.styles;
		const tasks = [];
		const results = {
			installed: [],
			failures: []
		};

		const packages = (Array.isArray(argv.packages) ? argv.packages : [ argv.packages ]).filter(Boolean);
		if (!packages.length) {
			throw new TypeError('Expected one or more package names');
		}

		this.skipExtensionUpdateCheck = true;

		for (const pkg of packages) {
			tasks.push({
				title: `Fetching metadata ${highlight(pkg)}`,
				async task(ctx, task) {
					try {
						await new Promise((resolve, reject) => {
							install(pkg)
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
									task.title = `Installed ${highlight(`${info.name}@${info.version}`)}`;
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
						task.title = alert(err.toString());
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

		const cfg = await loadConfig();
		cfg.delete('update.notified');
		cfg.save();

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		}

		for (const info of results.installed) {
			if (info.type === 'amplify-cli-plugin') {
				const ext = new Extension(info.path);

				// load the extension that was just installed so that it can receive the `axway:pm:install` action
				cli.extension(ext);

				if (!argv.json) {
					const cmds = Object.keys(ext.exports);
					if (cmds.length) {
						console.log(`\nTo use this new extension, run${cmds.length > 1 ? ' one of the following' : ''}:\n`);
						for (const name of cmds) {
							console.log(highlight(`  axway ${name}`));
						}
					}
				}
			}

			await cli.emitAction('axway:pm:install', info);
		}
	}
};
