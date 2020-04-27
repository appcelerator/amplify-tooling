export default {
	aliases: [ 'up' ],
	args: [
		{
			name: 'package',
			desc: 'The package name to update'
		}
	],
	desc: 'Download updates for installed packages',
	async action({ argv, console }) {
		const [
			{ default: Listr },
			{ addPackageToConfig, getInstalledPackages, PackageInstaller, Registry },
			{ getRegistryParams, handleInstallError }
		] = await Promise.all([
			import('listr'),
			import('@axway/amplify-registry-sdk'),
			import('../utils')
		]);

		async function installNewPackage(installData, task) {
			const installProcess = new PackageInstaller(installData);

			installProcess
				.on('preActions', () => {
					task.title = 'running pre-actions';
				})
				.on('download', () => {
					task.title = 'downloading package';
				})
				.on('extract', () => {
					task.title = 'extracting package';
				})
				.on('postActions', () => {
					task.title = 'running post-actions';
				});

			return await installProcess.start();
		}

		const registryParams = getRegistryParams(argv.env);
		const registry = new Registry(registryParams);
		const installed = getInstalledPackages({ packageName: argv.package });

		if (!installed.length) {
			const message = argv.package ? `${argv.package} is not installed` : 'There are no packages to update';
			if (argv.json) {
				console.log(JSON.stringify({ success: true, message }, null, '  '));
			} else {
				console.log(message);
			}
			return;
		}

		const listrRenderer = argv.json ? 'silent' : 'default';
		const tasks = new Listr({ concurrent: 10, exitOnError: false, renderer: listrRenderer });
		const updates = {
			alreadyActive: [],
			selected: [],
			installed: [],
			failures: []
		};
		for (const pkg of installed) {
			tasks.add({
				title: `Checking ${pkg.name}`,
				task: async (ctx, task) => {
					try {
						const meta = await registry.metadata({ name: pkg.name });

						if (pkg.version === meta.version) {
							task.title = `${pkg.name} is already set to use the latest version ${meta.version}`;
							updates.alreadyActive.push(`${pkg.name}@${meta.version}`);
							return;
						}

						if (Object.keys(pkg.versions).includes(meta.version)) {
							const versionData = pkg.versions[meta.version];
							task.title = `${pkg.name}@${meta.version} is installed, setting it as active`;
							await addPackageToConfig(pkg.name, versionData.path);
							updates.selected.push(`${pkg.name}@${meta.version}`);
						} else {
							task.title = `Downloading and installing ${pkg.name}@${meta.version}`;
							await installNewPackage({ name: pkg.name, fetchSpec: meta.version, ...registryParams }, task);
							updates.installed.push(`${pkg.name}@${meta.version}`);
						}

						task.title = `${pkg.name}@${meta.version} is now the active version!`;
						return;
					} catch (error) {
						const { message, exitCode } = handleInstallError(error);
						process.exitCode = exitCode;
						task.title = message;
						updates.failures.push({ name: pkg.name, message });
						throw error;
					}
				}
			});
		}
		try {
			await tasks.run();
			if (argv.json) {
				console.log(JSON.stringify({ success: true, message: updates }, null, '  '));
			}
		} catch (error) {
			if (argv.json) {
				console.log(JSON.stringify({ success: false, message: updates }, null, '  '));
			}
		}
	}
};
