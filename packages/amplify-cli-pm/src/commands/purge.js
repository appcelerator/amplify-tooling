export default {
	args: [
		{
			name: 'package',
			desc: 'Name of the package to purge old versions for'
		}
	],
	desc: 'Purges all unused packages',
	async action({ argv, console }) {
		const [
			{ getInstalledPackages },
			{ remove },
			{ default: Listr }
		] = await Promise.all([
			import('@axway/amplify-registry-sdk'),
			import('fs-extra'),
			import('listr')
		]);

		const packages = getInstalledPackages({ packageName: argv.package });

		if (!Object.keys(packages).length) {
			const message = argv.package ? `${argv.package} is not installed` : 'There are no packages to purge';
			if (argv.json) {
				console.log(JSON.stringify({ success: true, message }, null, '  '));
			} else {
				console.log(message);
			}
			return;
		}

		let packagesRemoved = 0;
		const listrRenderer = argv.json ? 'silent' : 'default';
		const removals = new Listr({ concurrent: 10, renderer: listrRenderer });
		const removedPackages = {};
		for (const { name, version, versions } of packages) {
			removedPackages[name] = [];
			for (const [ ver, versionData ] of Object.entries(versions)) {
				if (ver === version) {
					continue;
				}
				removals.add({
					title: `Purging ${name}@${ver}`,
					task: () => remove(versionData.path)
				});
				packagesRemoved++;
				removedPackages[name].push(ver);
			}
		}

		if (!packagesRemoved) {
			const message = 'All packages installed are currently active';
			if (argv.json) {
				console.log(JSON.stringify({ success: true, message }, null, '  '));
			} else {
				console.log(message);
			}
			return;
		}

		try {
			await removals.run();
			if (argv.json) {
				console.log(JSON.stringify({ success: true, message: removedPackages }, null, '  '));
			} else {
				console.log(`Removed ${packagesRemoved} package${packagesRemoved !== 1 ? 's' : ''}`);
			}
		} catch (error) {
			if (argv.json) {
				console.log(JSON.stringify({ success: false, message: error.stack }, null, '  '));
			} else {
				console.log(error.stack);
			}
			process.exitCode = 1;
		}
	}
};
