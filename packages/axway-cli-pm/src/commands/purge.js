export default {
	args: [
		{
			name: 'package',
			desc: 'Name of the package to purge old versions for'
		}
	],
	desc: 'Removes all non-active, managed packages',
	options: {
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the purged packages as JSON'
		}
	},
	async action({ argv, cli, console }) {
		const [
			{ getInstalledPackages, packagesDir },
			{ default: Listr },
			semver,
			{ default: snooplogg },
			{ uninstallPackage }
		] = await Promise.all([
			import('@axway/amplify-registry-sdk'),
			import('listr'),
			import('semver'),
			import('snooplogg'),
			import('../utils')
		]);

		const { highlight } = snooplogg.styles;
		const packages = getInstalledPackages({ packageName: argv.package });

		if (!Object.keys(packages).length) {
			const message = argv.package ? `Package "${argv.package}" is not installed` : 'There are no packages to purge';
			if (argv.json) {
				console.log(JSON.stringify({ message }, null, 2));
			} else {
				console.log(message);
			}
			return;
		}

		const tasks = new Listr({
			concurrent: 10,
			renderer: argv.json ? 'silent' : 'default'
		});
		let packagesRemoved = 0;
		const removedPackages = {};

		for (const { name, version, versions } of packages) {
			for (const [ ver, versionData ] of Object.entries(versions)) {
				if (versionData.managed && versionData.path.startsWith(packagesDir) && semver.neq(ver, version)) {
					tasks.add({
						title: `Purging ${highlight(`${name}@${ver}`)}`,
						task: () => uninstallPackage(versionData.path)
					});
					packagesRemoved++;
					if (!removedPackages[name]) {
						removedPackages[name] = [];
					}
					removedPackages[name].push(ver);
				}
			}
		}

		if (!packagesRemoved) {
			const message = 'All packages installed are currently active.';
			if (argv.json) {
				console.log(JSON.stringify({ message }, null, 2));
			} else {
				console.log(`${message}\n`);
			}
			return;
		}

		try {
			await tasks.run();
		} catch (err) {
			// errors are stored in the results
		}

		await cli.emitAction('axway:pm:purge', removedPackages);

		if (argv.json) {
			console.log(JSON.stringify(removedPackages, null, 2));
		} else {
			console.log(`\nRemoved ${packagesRemoved} package${packagesRemoved !== 1 ? 's' : ''}`);
		}
	}
};
