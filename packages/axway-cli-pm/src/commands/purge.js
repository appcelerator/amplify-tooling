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
		const semver                 = require('semver');
		const { default: snooplogg } = require('snooplogg');
		const { runListr }           = require('../utils');
		const { find, list, packagesDir, uninstallPackage } = require('../pm');

		const { highlight } = snooplogg.styles;
		let packages = [];
		let packagesRemoved = 0;
		const removedPackages = {};
		const tasks = [];

		// get installed packages
		if (argv.package) {
			const pkg = await find(argv.package);
			if (!pkg) {
				throw new Error(`Package "${argv.package}" is not installed`);
			}
			packages.push(pkg);
		} else {
			packages = await list();
		}

		// determine packages to remove
		for (const { name, version, versions } of packages) {
			for (const [ ver, versionData ] of Object.entries(versions)) {
				// if managed and not in use
				if (versionData.managed && versionData.path.startsWith(packagesDir) && semver.neq(ver, version)) {
					tasks.push({
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
			if (argv.json) {
				console.log(JSON.stringify(removedPackages, null, 2));
			} else {
				console.log('There are no packages to purge.');
			}
			return;
		}

		try {
			await runListr({ console, json: argv.json, tasks });
		} catch (err) {
			// errors are stored in the results
		}

		if (argv.json) {
			console.log(JSON.stringify(removedPackages, null, 2));
		} else {
			console.log(`\nRemoved ${packagesRemoved} package${packagesRemoved !== 1 ? 's' : ''}:`);
			for (const name of Object.keys(removedPackages).sort()) {
				for (const ver of removedPackages[name].sort(semver.compare)) {
					console.log(`  ${highlight(`${name}@${ver}`)}`);
				}
			}
		}

		await cli.emitAction('axway:pm:purge', removedPackages);
	}
};
