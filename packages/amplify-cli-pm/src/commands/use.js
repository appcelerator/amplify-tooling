/**
 * Examples:
 * 	amplify pm use appcd
 * 	amplify pm use appcd@1.0.1
 * 	amplify pm use appcd@latest
 * 	amplify pm use appcd@1.x
 */

export default {
	args: [
		{
			name: 'package',
			hint: 'package[@version]',
			desc: 'the package version or latest to activate',
			required: true
		}
	],
	desc: 'activates a specific package version',
	async action({ argv, console }) {
		const [
			{ default: npa },
			semver,
			{ addPackageToConfig, getInstalledPackages }
		] = await Promise.all([
			import('npm-package-arg'),
			import('semver'),
			import('@axway/amplify-registry-sdk')
		]);

		try {
			let { type, name, fetchSpec } = npa(argv.package);
			let installed;
			for (const pkg of getInstalledPackages()) {
				if (pkg.name === name) {
					installed = pkg;
					break;
				}
			}

			if (!installed) {
				throw new Error(`${name} is not installed, please run "amplify pm install ${name}" first`);
			}

			if (fetchSpec === 'latest') {
				fetchSpec = '*';
			}

			let version;
			if (fetchSpec === '*' || type === 'range') {
				version = semver.maxSatisfying(Object.keys(installed.versions), fetchSpec);
			} else if (type === 'version') {
				version = fetchSpec;
			}
			if (!version) {
				throw new Error(`No version installed that satisfies ${fetchSpec}`);
			}

			const info = installed.versions[version];
			if (!info) {
				// TODO: Bikeshed the semantic differences between use and install, whether use should install
				// a package if it is not available and whether install should set a package as in use after install
				throw new Error(`${name}@${version} is not installed\nPlease run "amplify pm install ${name}@${version}" to install it`);
			}

			const active = installed.version === version;
			let msg;
			if (active) {
				msg = `${name}@${version} is already the active version`;
			} else {
				msg = `Set ${name}@${version} as action version`;
				await addPackageToConfig(name, info.path);
			}

			if (argv.json) {
				console.log(JSON.stringify({
					success: true,
					name,
					version,
					path: info.path
				}, null, '  '));
			} else {
				console.log(msg);
			}
		} catch (err) {
			if (argv.json) {
				console.error(JSON.stringify({ success: false, message: err.message }, null, '  '));
			} else {
				console.error(err);
			}
			process.exit(1);
		}
	}
};
