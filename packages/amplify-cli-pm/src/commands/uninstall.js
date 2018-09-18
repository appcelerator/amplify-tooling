export default {
	aliases: [ 'un', 'unlink', 'r', 'rm', 'remove' ],
	args: [
		{
			name: 'package',
			hint: 'package[@version]',
			desc: 'the package name and version to uninstall',
			required: true
		}
	],
	desc: 'uninstalls the specified package',
	async action({ argv, console }) {
		const [
			fs,
			{ default: npa },
			semver,
			{ getInstalledPackages, removePackageFromConfig }
		] = await Promise.all([
			import('fs-extra'),
			import('npm-package-arg'),
			import('semver'),
			import('@axway/amplify-registry-sdk')
		]);

		try {
			const { type, name, fetchSpec } = npa(argv.package);
			let installed;
			for (const pkg of getInstalledPackages()) {
				if (pkg.name === name) {
					installed = pkg;
					break;
				}
			}

			if (!installed) {
				throw new Error(`"${name}" is not installed`);
			}

			const installedVersions = Object.keys(installed.versions);
			const replacement = {};
			const versions = [];

			if (type === 'range') {
				for (const ver of installedVersions) {
					if (semver.satisfies(ver, fetchSpec)) {
						versions.push({ version: ver, ...installed.versions[ver] });
					}
				}
			} else if (type === 'version') {
				const info = installed.versions[fetchSpec];
				if (info) {
					versions.push({ version: fetchSpec, ...info });
				}
			} else if (type === 'tag' && fetchSpec === 'latest') {
				const version = semver.maxSatisfying(installedVersions, semver.validRange('*'));
				if (version) {
					versions.push({ version, ...installed.versions[version] });
				}
			}

			if (!versions.length) {
				throw new Error(`"${name}${fetchSpec === 'latest' ? '' : `@${fetchSpec}`}" is not installed`);
			}

			// check if we're NOT uninstalling all versions, and if so, suggest a replacement
			if (installedVersions.length > versions.length) {
				const removed = versions.map(v => v.version);
				const toSelectFrom = installedVersions.filter(v => !removed.includes(v));
				const newVersion = semver.maxSatisfying(toSelectFrom, semver.validRange('*'));
				replacement.path = installed.versions[newVersion].path;
				replacement.version = newVersion;
			}

			// unregister extension
			await removePackageFromConfig(name, replacement.path);

			for (const { version, path } of versions) {
				fs.removeSync(path);
				if (!argv.json) {
					console.log(`Removed ${name}@${version}`);
				}
			}

			if (argv.json) {
				console.log(JSON.stringify(versions, null, '  '));
			} else if (replacement.path) {
				console.log(`Set ${name}@${replacement.version} as the active version`);
			}
		} catch (err) {
			if (argv.json) {
				console.error(JSON.stringify({ success: false, message: err.message }, null, '  '));
			} else {
				console.error(err.message);
			}
			process.exit(1);
		}
	}
};
