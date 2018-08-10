export default {
	desc: 'uninstalls the specified package',
	args: [
		{
			name: 'package',
			hint: 'package[@version]',
			desc: 'the package name and version to uninstall',
			required: true
		}
	],
	async action({ argv, console }) {
		const [
			fs,
			npa,
			semver,
			{ getInstalledPackages, removePackageFromConfig }
		] = await Promise.all([
			import('fs-extra'),
			import('npm-package-arg'),
			import('semver'),
			import('@axway/amplify-registry-sdk')
		]);

		const info = npa(argv.package);
		const { type, name, fetchSpec } = info;
		const { packageType } = argv;

		const installed = getInstalledPackages().filter(pkg => pkg.name === name)[0];
		const versions = [];

		if (type === 'range') {
			for (const version of installed.versions) {
				if (semver.satisfies(version, fetchSpec)) {
					versions.push(installed.versionInfo[version]);
				}
			}
		} else if (type === 'version') {
			versions.push(installed.versionInfo[fetchSpec]);
		}
		const replacement = {};
		if (versions.length && installed.versions.length > versions.length) {
			const removed = versions.map(v => v.version);
			const toSelectFrom = installed.versions.filter(v => !removed.includes(v));
			const newVersion = semver.maxSatisfying(toSelectFrom, semver.validRange('*'));
			replacement.path = installed.versionInfo[newVersion].installPath;
			replacement.version = newVersion;
		}
		await removePackageFromConfig(name, replacement.path);
		if (versions.length) {
			for (const { version, installPath } of versions) {
				fs.removeSync(installPath);
				console.log(`Removed ${name}@${version}`);
			}
			if (replacement.path) {
				console.log(`Set ${name}@${replacement.version} as the active version`);
			}
		} else {
			fs.removeSync(installed.installPath);
			console.log(`Removed all ${name} versions`);
		}
	}
};
