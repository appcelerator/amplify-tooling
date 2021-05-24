export default {
	aliases: [ 's', '!se' ],
	args: [
		{
			name: 'keyword',
			desc: 'The package name or keywords'
		}
	],
	desc: 'Searches registry for packages',
	options: {
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs packages as JSON'
		},
		'--limit [count]': 'The maximum number of packages to return (default: 50)',
		'--type [type]': 'Type of package to search'
	},
	async action({ argv, console }) {
		const { createTable } = require('@axway/amplify-cli-utils');
		const { search }      = require('../pm');

		const results = await search(argv);

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
			return;
		}

		if (!results.length) {
			console.log('No results');
			return;
		}

		const table = createTable([ 'Name', 'Versions', 'Type', 'Description' ]);

		for (const pkg of results) {
			table.push([
				pkg.name,
				pkg.version,
				pkg.type,
				pkg.description
			]);
		}

		console.log(table.toString());
	}
};
