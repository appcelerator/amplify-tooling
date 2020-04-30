export default {
	args: [
		{
			name: 'package',
			desc: 'Name of the package to purge old versions for'
		}
	],
	desc: 'Purges all unused packages',
	options: {
		'--json': 'Outputs results as JSON'
	},
	async action({ argv, console }) {
		const [
			{ getInstalledPackages },
			{ remove },
			{ default: Listr },
			semver,
			{ default: snooplogg },
			{ handleError }
		] = await Promise.all([
			import('@axway/amplify-registry-sdk'),
			import('fs-extra'),
			import('listr'),
			import('semver'),
			import('snooplogg'),
			import('../utils')
		]);

		try {
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

			const removals = new Listr({
				concurrent: 10,
				renderer: argv.json ? 'silent' : 'default'
			});
			let packagesRemoved = 0;
			const removedPackages = {};

			for (const { name, version, versions } of packages) {
				for (const [ ver, versionData ] of Object.entries(versions)) {
					if (versionData.managed && semver.neq(ver, version)) {
						removals.add({
							title: `Purging ${highlight(`${name}@${ver}`)}`,
							task: () => remove(versionData.path)
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

			await removals.run();

			if (argv.json) {
				console.log(JSON.stringify(removedPackages, null, 2));
			} else {
				console.log(`\nRemoved ${packagesRemoved} package${packagesRemoved !== 1 ? 's' : ''}`);
			}
		} catch (err) {
			handleError({ console, err, json: argv.json });
		}
	}
};
