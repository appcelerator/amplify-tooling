export default {
	aliases: [ 'v', 'info', 'show' ],
	desc: 'displays info for a specific package',
	args: [
		{
			name: 'package',
			hint: 'package[@version]',
			desc: 'the package name and version to install',
			required: true
		},
		{
			name: 'filter',
			hint: 'field[.subfield]',
			desc: 'display specific package fields'
		}
	],
	async action({ argv, console }) {
		const [
			npa,
			{ getRegistryURL },
			{ Registry }
		] = await Promise.all([
			import('npm-package-arg'),
			import('../utils'),
			import('@axway/amplify-registry-sdk')
		]);

		const url = getRegistryURL();
		const registry = new Registry({ url });
		const info = npa(argv.package);
		const { name, fetchSpec } = info;
		const { packageType } = argv;
		let version;
		if (fetchSpec !== 'latest') {
			version = fetchSpec;
		}

		try {
			const result = await registry.metadata({ name, type: packageType, version });
			if (!result) {
				console.log(`No result found for ${name}`);
				return;
			}
			console.log(result);
		} catch (e) {
			console.log(e);
		}
	}
};
