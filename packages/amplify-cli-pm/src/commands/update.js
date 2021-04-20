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
	async action({ argv, cli, console }) {
		const [
			{ addPackageToConfig, getInstalledPackages, PackageInstaller, Registry },
			{ default: Listr },
			{ default: snooplogg },
			{ getRegistryParams, formatError }
		] = await Promise.all([
			import('@axway/amplify-registry-sdk'),
			import('listr'),
			import('snooplogg'),
			import('../utils')
		]);

		async function installNewPackage(installData, task) {
			const installProcess = new PackageInstaller(installData);
			const { name, fetchSpec: version } = installData;

			installProcess
				.on('preActions', () => {
					task.title = `Running pre-actions ${highlight(`${name}@${version}`)}`;
				})
				.on('download', () => {
					task.title = `Downloading package ${highlight(`${name}@${version}`)}`;
				})
				.on('extract', () => {
					task.title = `Extracting package ${highlight(`${name}@${version}`)}`;
				})
				.on('postActions', () => {
					task.title = `Running post-actions ${highlight(`${name}@${version}`)}`;
				});

			return await installProcess.start();
		}

		const registryParams = getRegistryParams(argv.env);
		const registry = new Registry(registryParams);
		const installed = getInstalledPackages({ packageName: argv.package });

		if (!installed.length) {
			const err = new Error(argv.package ? `${argv.package} is not installed` : 'There are no packages to update');
			err.code = 'ENOTFOUND';
			throw err;
		}

		const { highlight } = snooplogg.styles;
		const tasks = new Listr({
			concurrent: 10,
			exitOnError: false,
			renderer: argv.json ? 'silent' : 'default'
		});
		const results = {
			alreadyActive: [],
			selected: [],
			installed: [],
			failures: []
		};

		for (const pkg of installed) {
			tasks.add({
				title: `Checking ${highlight(pkg.name)}`,
				async task(ctx, task) {
					try {
						const meta = await registry.metadata({ name: pkg.name });

						if (pkg.version === meta.version) {
							task.title = `${highlight(`${pkg.name}@${meta.version}`)} is already up-to-date`;
							results.alreadyActive.push(`${pkg.name}@${meta.version}`);
							return;
						}

						if (Object.keys(pkg.versions).includes(meta.version)) {
							const versionData = pkg.versions[meta.version];
							task.title = `${highlight(`${pkg.name}@${meta.version}`)} is installed, setting it as active`;
							await addPackageToConfig(pkg.name, versionData.path);
							results.selected.push(`${pkg.name}@${meta.version}`);
						} else {
							task.title = `Downloading and installing ${highlight(`${pkg.name}@${meta.version}`)}`;
							await installNewPackage({ name: pkg.name, fetchSpec: meta.version, ...registryParams }, task);
							results.installed.push(`${pkg.name}@${meta.version}`);
						}

						task.title = `${highlight(`${pkg.name}@${meta.version}`)} set as active version`;
					} catch (err) {
						err = formatError(err);
						process.exitCode = err.exitCode || 1;
						results.failures.push({ package: pkg.name, error: err.toString() });
						throw err;
					}
				}
			});
		}

		try {
			await tasks.run();
		} catch (err) {
			// errors are stored in the results
		}

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		}

		await cli.emitAction('axway:pm:update', results);
	}
};
