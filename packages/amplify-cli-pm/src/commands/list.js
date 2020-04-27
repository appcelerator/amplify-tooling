export default {
	aliases: [ 'ls' ],
	desc: 'Lists all installed packages',
	async action({ argv, console }) {
		const [
			{ getInstalledPackages, packagesDir },
			{ default: Table },
			snooplogg
		] = await Promise.all([
			import('@axway/amplify-registry-sdk'),
			import('cli-table3'),
			import('snooplogg')
		]);

		const installed = getInstalledPackages();

		if (argv.json) {
			console.log(JSON.stringify(installed, null, '  '));
			return;
		}

		const { cyan, gray, green } = snooplogg.styles;
		console.log(`Packages directory: ${cyan(packagesDir)}\n`);

		if (!installed.length) {
			console.log('No packages installed');
			return;
		}

		const table = new Table({
			chars: {
				bottom: '', 'bottom-left': '', 'bottom-mid': '', 'bottom-right': '',
				left: '', 'left-mid': '',
				mid: '', 'mid-mid': '', middle: '  ',
				right: '', 'right-mid': '',
				top: '', 'top-left': '', 'top-mid': '', 'top-right': ''
			},
			head: [ 'Name', 'Installed Versions', 'Active Version' ],
			style: {
				head: [ 'bold' ],
				'padding-left': 0,
				'padding-right': 0
			}
		});

		const unmanaged = {};

		for (const pkg of installed) {
			const { managed } = pkg.versions[pkg.version];
			table.push([
				managed || Object.keys(pkg.versions).some(ver => pkg.versions[ver].managed) ? green(pkg.name) : `${cyan(pkg.name)} ${gray('(unmanaged)')}`,
				Object.keys(pkg.versions)
					.map(ver => {
						if (pkg.versions[ver].managed) {
							return ver;
						}
						unmanaged[`${pkg.name}${ver}`] = 1;
						return cyan(ver);
					})
					.join(', '),
				!pkg.version ? 'Unknown' : managed ? pkg.version : cyan(pkg.version)
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
