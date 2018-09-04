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
			{ addPackageToConfig, fetchAndInstall, getInstalledPackages, Registry },
			{ getRegistryParams, handleInstallError }
		] = await Promise.all([
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

		for (const pkg of installed) {
			try {
				const meta = await registry.metadata({ name: pkg.name });
				if (pkg.version === meta.version) {
					console.log(`${pkg.name} is already set to use the latest version ${meta.version}`);
					continue;
				}
				if (Object.keys(pkg.versions).includes(meta.version)) {
					const versionData = pkg.versions[meta.version];
					await addPackageToConfig(pkg.name, versionData.path);
				} else {
					console.log(`Downloading and installing ${pkg.name}@${meta.version}`);
					await fetchAndInstall({ name: pkg.name, fetchSpec: meta.version, ...registryParams });
				}
				console.log(`${pkg.name}@${meta.version} is now the active version!`);
			} catch (error) {
				const { message, exitCode } = handleInstallError(error);

				if (argv.json) {
					console.error(JSON.stringify({ success: false, message }, null, '  '));
				} else {
					console.error(message);
				}

				process.exitCode = exitCode;
			}
		}
	}
};
