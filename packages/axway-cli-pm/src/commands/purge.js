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
		const { listPurgable, uninstallPackage } = require('../pm');

		const { highlight } = snooplogg.styles;
		let packagesRemoved = 0;
		const removedPackages = {};
		const tasks = [];
		const purgable = await listPurgable(argv.package);

		// determine packages to remove
		for (const [ name, versions ] of Object.entries(purgable)) {
			for (const ver of versions) {
				tasks.push({
					title: `Purging ${highlight(`${name}@${ver}`)}`,
					task: () => uninstallPackage(ver.path)
				});
				packagesRemoved++;
				if (!removedPackages[name]) {
					removedPackages[name] = [];
				}
				removedPackages[name].push(ver);
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
