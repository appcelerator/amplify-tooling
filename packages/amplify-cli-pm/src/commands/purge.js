export default {
	args: [
		{
			name: 'package',
			hint: 'package',
			desc: 'name of the package to purge old versions for',
			required: false
		}
	],
	desc: 'purges all unused packages',
	async action({ argv }) {
		const [
			{ getInstalledPackages },
			{ remove },
			Listr
		] = await Promise.all([
			import('@axway/amplify-registry-sdk'),
			import('fs-extra'),
			import('listr')
		]);

		const packages = getInstalledPackages()
			.filter(pkg => !argv.package || argv.package === pkg.name);

		if (!Object.keys(packages).length) {
			console.log(argv.package ? `${argv.package} is not installed` : 'There are no packages to purge');
			return;
		}

		let packagesRemoved = 0;
		const removals = new Listr({ concurrent: 10 });
		for (const { name, version, versions } of packages) {
			for (const [ ver, versionData ] of Object.entries(versions)) {
				if (ver === version) {
					continue;
				}
				removals.add({
					title: `Purging ${name}@${ver}`,
					task: () => remove(versionData.path)
				});
				packagesRemoved++;
			}
		}

		if (!removals._tasks.length) {
			console.log('All packages installed are currently active');
			return;
		}
		await removals.run();
		console.log(`Removed ${packagesRemoved} package(s)`);
	}
};
