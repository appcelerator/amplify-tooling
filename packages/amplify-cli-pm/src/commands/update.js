export default {
	aliases: [ 'up' ],
	args: [
		{
			name: 'package',
			hint: 'package',
			desc: 'the package name to update'
		}
	],
	desc: 'download updates for installed packages',
	options: {
		'--auth <account>': 'the authorization account to use'
	},
	async action({ argv }) {
		const [
			Listr,
			{ addPackageToConfig, fetchAndInstall, getInstalledPackages, Registry },
			{ getRegistryParams, handleInstallError }
		] = await Promise.all([
			import('listr'),
			import('@axway/amplify-registry-sdk'),
			import('../utils')
		]);
		const registryParams = getRegistryParams(argv.env);
		const registry = new Registry(registryParams);
		const installed = getInstalledPackages()
			.filter(pkg => !argv.package || argv.package === pkg.name);

		if (!installed.length) {
			console.log(argv.package ? `${argv.package} is not installed` : 'There are no packages to update');
			return;
		}
		const tasks = new Listr({ concurrent: 10 });

		for (const pkg of installed) {
			tasks.add({
				title: `Checking ${pkg.name}`,
				task: async (ctx, task) => {
					try {
						const meta = await registry.metadata({ name: pkg.name });

						if (pkg.version === meta.version) {
							task.title = `${pkg.name} is already set to use the latest version ${meta.version}`;
							return;
						}

						if (Object.keys(pkg.versions).includes(meta.version)) {
							const versionData = pkg.versions[meta.version];
							task.title = `${pkg.name}@${meta.version} is installed, setting it as active`;
							await addPackageToConfig(pkg.name, versionData.path);
						} else {
							task.title = `Downloading and installing ${pkg.name}@${meta.version}`;
							await fetchAndInstall({ name: pkg.name, fetchSpec: meta.version, ...registryParams });
						}

						task.title = `${pkg.name}@${meta.version} is now the active version!`;
						return;
					} catch (error) {
						const { message, exitCode } = handleInstallError(error);
						process.exitCode = exitCode;
						task.title = message;
					}
				}
			});
		}
		await tasks.run();
	}
};
