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
		const installed = getInstalledPackages();
		const toUpdate = [];
		if (argv.package) {
			for (const pkg of installed) {
				if (pkg.name === argv.package) {
					toUpdate.push(pkg);
				}
			}
		} else {
			toUpdate.push(...installed);
		}

		if (!toUpdate.length) {
			console.log(argv.package ? `${argv.package} is not installed` : 'There are no packages to update');
			return;
		}

		for (const pkg of toUpdate) {
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
