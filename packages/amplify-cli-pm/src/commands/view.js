export default {
	aliases: [ 'v', 'info', 'show' ],
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
	desc: 'displays info for a specific package',
	options: {
		'--json': 'outputs accounts as JSON',
		'--type <name>': {
			desc: 'the package type',
			values: {
				connector: 'an API builder connector',
				npm: 'an npm package'
			}
		}
	},
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

		const { name, fetchSpec } = npa(argv.package);
		const registry = new Registry({
			url: getRegistryURL()
		});

		try {
			const result = await registry.metadata({
				name,
				type: argv.type,
				version: fetchSpec !== 'latest' && fetchSpec
			});

			if (argv.json) {
				console.log(JSON.stringify(result, null, '  '));
			} else if (result) {
				// TODO: render results a little nicer... possibly use a template?
				console.log(result);
			} else {
				console.log(`No result found for ${name}`);
			}
		} catch (e) {
			if (argv.json) {
				console.log({ success: false, message: e.message });
			} else {
				console.log(e);
			}
			process.exit(1);
		}
	}
};
