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
		const npmsearch = require('libnpmsearch');
		const pacote = require('pacote');
		const promiseLimit = require('promise-limit')(10);
		const { createRequestOptions, createTable } = require('@axway/amplify-cli-utils');

		const requestOpts = createRequestOptions();
		const { keyword, limit, type } = argv;
		const packages = await npmsearch([ 'amplify-package', keyword ], {
			...requestOpts,
			limit: Math.max(limit && parseInt(limit, 10) || 50, 1)
		});
		const results = [];

		await Promise.all(packages.map(({ name, version }) => {
			return promiseLimit(async () => {
				const info = await pacote.packument(`${name}@${version}`, {
					...requestOpts,
					fullMetadata: true
				});
				const pkg = info.versions[version];
				const maintainers = [ 'appcelerator', 'axway-npm' ];

				if (!pkg
					|| !pkg.amplify?.type
					|| (type && pkg.amplify.type !== type)
					|| pkg.keywords.includes('amplify-test-package')
					|| !pkg.keywords.includes('amplify-package')
					|| !pkg.maintainers.some(m => maintainers.includes(m.name))
				) {
					return;
				}

				results.push({
					name:        pkg.name,
					version:     pkg.version,
					type:        pkg.amplify.type,
					description: pkg.description
				});
			});
		}));

		results.sort((a, b) => a.name.localeCompare(b.name));

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
