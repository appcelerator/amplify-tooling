export default {
	aliases: [ 'v', '!info', '!show' ],
	args: [
		{
			name: 'package',
			hint: 'package[@version]',
			desc: 'The package name and version to view',
			required: true
		},
		{
			name: 'filter',
			hint: 'field[.subfield]',
			desc: 'Display specific package fields'
		}
	],
	desc: 'Displays info for a specific package',
	options: {
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs package info as JSON'
		},
		'--type [name]': {
			desc: 'The package type',
			values: {
				'amplify-cli-plugin': 'An Axway CLI plugin package',
				'apib-data-connector': 'An API builder connector'
			}
		}
	},
	async action({ argv, cli, console }) {
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

		let result = await registry.metadata({
			name,
			type: argv.type,
			version: fetchSpec !== 'latest' && fetchSpec
		});

		if (argv.filter) {
			for (const key of argv.filter.split('.')) {
				if (typeof result !== 'object') {
					break;
				}
				result = Object.prototype.hasOwnProperty.call(result, key) ? result[key] : undefined;
			}
		}

		if (argv.json) {
			cli.banner = false;
			console.log(JSON.stringify(result, null, 2));
		} else if (result) {
			// TODO: render results a little nicer... possibly use a template?
			console.log(result);
		} else {
			console.log(`No result found for ${name}`);
		}
	}
};
