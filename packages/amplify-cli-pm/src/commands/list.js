export default {
	aliases: [ 'ls' ],
	desc: 'lists all installed packages',
	options: {
		'--json': 'outputs accounts as JSON'
	},
	async action({ argv, console }) {
		const { getInstalledPackages } = await import('@axway/amplify-registry-sdk');
		const installed = getInstalledPackages();

		if (argv.json) {
			console.log(JSON.stringify(installed, null, '  '));
			return;
		}

		if (!installed.length) {
			console.log('No packages installed');
			return;
		}

		console.log('| Name | Active Version | Installed Versions |');
		console.log('| ---- | -------------- | ------------------ |');
		for (const pkg of installed) {
			console.log(`| ${pkg.name} | ${pkg.version || 'No active version'} | ${Object.keys(pkg.versions).join(', ') || 'No versions found'} |`);
		}
	}
};
