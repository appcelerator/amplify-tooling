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
		'--type <name>': {
			desc: 'the package type',
			values: {
				'amplify-cli-plugin': 'an AMPFLIY CLI plugin package',
				'apib-data-connector': 'an API builder connector'
			}
		}
	},
	async action({ argv, console }) {
		const [
			{ default: npa },
			{ getRegistryParams },
			{ Registry }
		] = await Promise.all([
			import('npm-package-arg'),
			import('../utils'),
			import('@axway/amplify-registry-sdk')
		]);

		const { name, fetchSpec } = npa(argv.package);
		const registry = new Registry(getRegistryParams(argv.env));

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
		} catch (err) {
			if (argv.json) {
				console.error({ success: false, message: err.message });
			} else {
				console.error(err);
			}
			process.exit(1);
		}
	}
};
