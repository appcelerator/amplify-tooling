export default {
	aliases: [ '!un', '!unlink', '!r', 'rm', '!remove' ],
	args: [
		{
			name: 'package',
			hint: 'package[@version]',
			desc: 'The package name and version to uninstall',
			required: true
		}
	],
	desc: 'Removes the specified package',
	options: {
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs removed packages as JSON'
		}
	},
	async action({ argv, cli, console }) {
		const [
			{ getInstalledPackages, packagesDir, removePackageFromConfig },
			fs,
			{ dirname },
			semver,
			{ default: npa },
			{ default: snooplogg },
			{ handleError, uninstallPackage }
		] = await Promise.all([
			import('@axway/amplify-registry-sdk'),
			import('fs-extra'),
			import('path'),
			import('semver'),
			import('npm-package-arg'),
			import('snooplogg'),
			import('../utils')
		]);

		const { highlight, note } = snooplogg.styles;

		try {
			const { type, name, fetchSpec } = npa(argv.package);
			const installed = getInstalledPackages().find(pkg => pkg.name === name);

			if (!installed) {
				throw new Error(`Package "${name}" is not installed`);
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
				let version;
				for (const ver of installedVersions) {
					if (!version || semver.gt(ver, version)) {
						version = ver;
					}
				}
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
				let newVersion;
				for (const ver of toSelectFrom) {
					if (!newVersion || semver.gt(ver, newVersion)) {
						newVersion = ver;
					}
				}
				replacement.path = installed.versions[newVersion].path;
				replacement.version = newVersion;
			}

			// unregister extension
			if (!argv.json) {
				console.log(`Unregistering ${highlight(name)}`);
			}
			await removePackageFromConfig(name, replacement.path);

			for (const { managed, path, version } of versions) {
				if (managed && path.startsWith(packagesDir)) {
					if (!argv.json) {
						console.log(`Deleting ${highlight(`${name}@${version}`)} ${note(`(${path})`)}`);
					}
					await uninstallPackage(path);

					const parent = dirname(path);
					if (!fs.readdirSync(parent).filter(file => file !== '.DS_Store').length) {
						await fs.remove(parent);
					}
				}
			}

			await cli.emitAction('axway:pm:uninstall', versions);

			if (argv.json) {
				console.log(JSON.stringify(versions, null, 2));
			} else if (replacement.path) {
				console.log(`${highlight(`${name}@${replacement.version}`)} is now the active version`);
			}
		} catch (err) {
			handleError({ console, err, json: argv.json });
		}
	}
};
