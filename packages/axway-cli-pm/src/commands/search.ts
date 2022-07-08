import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';

export default {
	aliases: [ 's', '!se' ],
	args: [
		{
			name: 'keyword',
			desc: 'The package name or keywords',
			redact: false
		}
	],
	desc: 'Searches registry for packages',
	options: {
		'--json': {
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
			desc: 'Outputs packages as JSON'
		},
		'--limit [count]': { desc: 'The maximum number of packages to return (default: 50)', redact: false },
		'--type [type]': { desc: 'Type of package to search', redact: false }
	},
	async action({ argv, console }: AxwayCLIState): Promise<void> {
		const { createTable } = await import('@axway/amplify-cli-utils');
		const { search }      = await import('../pm.js');

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
