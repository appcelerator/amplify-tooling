export default {
	aliases: [ 'ls' ],
	desc: 'Lists all installed packages',
	options: {
		'--json': 'Outputs packages as JSON'
	},
	async action({ argv, console }) {
		const [
			{ createTable },
			{ getInstalledPackages, packagesDir },
			semver,
			{ default: snooplogg }
		] = await Promise.all([
			import('@axway/amplify-cli-utils'),
			import('@axway/amplify-registry-sdk'),
			import('semver'),
			import('snooplogg')
		]);

		const installed = getInstalledPackages();

		if (argv.json) {
			console.log(JSON.stringify(installed, null, 2));
			return;
		}

		const { cyan, gray } = snooplogg.styles;
		console.log(`Packages directory: ${cyan(packagesDir)}\n`);

		if (!installed.length) {
			console.log('No packages installed');
			return;
		}

		const table = createTable('Name', 'Versions');
		const unmanaged = {};

		for (const pkg of installed) {
			const { version } = pkg;
			const { managed } = pkg.versions[version];
			const versions = Object.keys(pkg.versions).sort(semver.rcompare);

			table.push([
				managed || Object.keys(pkg.versions).some(ver => pkg.versions[ver].managed) ? pkg.name : `${pkg.name} ${gray('(unmanaged)')}`,
				versions.map(v => semver.eq(v, version) ? cyan(v) : v).join(', ')
			]);
			if (!managed) {
				unmanaged[`${pkg.name}${pkg.version}`] = 1;
			}
		}

		console.log(table.toString());

		if (Object.keys(unmanaged).length) {
			console.log('\nNote: Unmanaged packages were not installed by the AMPLIFY CLI and cannot be updated, uninstalled, or purged.');
		}
	}
};
