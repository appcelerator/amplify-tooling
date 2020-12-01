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
			desc: 'The package version or latest to activate',
			required: true
		}
	],
	desc: 'Activates a specific package version',
	options: {
		'--json': 'Outputs activated package as JSON'
	},
	async action({ argv, cli, console }) {
		const [
			{ addPackageToConfig, getInstalledPackages },
			{ default: npa },
			semver,
			{ default: snooplogg },
			{ handleError }
		] = await Promise.all([
			import('@axway/amplify-registry-sdk'),
			import('npm-package-arg'),
			import('semver'),
			import('snooplogg'),
			import('../utils')
		]);

		const { highlight } = snooplogg.styles;
		let { type, name, fetchSpec } = npa(argv.package);
		const installed = getInstalledPackages().find(pkg => pkg.name === name);

		try {
			if (!installed) {
				const err = new Error(`${name} is not installed`);
				err.code = 'ENOTFOUND';
				err.detail = `Please run ${highlight(`"amplify pm install ${name}"`)} to install it`;
				throw err;
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
				const err = new Error(`${name}@${version} is not installed`);
				err.code = 'ENOTFOUND';
				err.detail = `Please run ${highlight(`"amplify pm install ${name}@${version}"`)} to install it`;
				throw err;
			}

			let msg;
			if (installed.version === version) {
				msg = `${highlight(`${name}@${version}`)} is already the active version`;
			} else {
				msg = `Set ${highlight(`${name}@${version}`)} as action version`;
				await addPackageToConfig(name, info.path);
			}

			await cli.emitAction('axway:pm:use', info);

			if (argv.json) {
				console.log(JSON.stringify(info, null, 2));
			} else {
				console.log(msg);
			}
		} catch (err) {
			handleError({ console, err, json: argv.json });
		}
	}
};
