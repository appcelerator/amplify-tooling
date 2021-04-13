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
		'--repository [repository]': 'The originating repository',
		'--type [type]': 'Type of package to search'
	},
	async action({ argv, console }) {
		const [
			{ createTable },
			{ Registry },
			{ buildUserAgentString, getRegistryParams }
		] = await Promise.all([
			import('@axway/amplify-cli-utils'),
			import('@axway/amplify-registry-sdk'),
			import('../utils')
		]);

		const registry = new Registry(getRegistryParams(argv.env));
		const { keyword, repository, type } = argv;
		const headers = {
			'User-Agent': buildUserAgentString()
		};
		let results;

		try {
			results = (await registry.search({ headers, text: keyword, repository, type })).map(d => {
				return {
					name:        d.name,
					version:     d.version,
					type:        d.type,
					description: d.description
				};
			});
		} catch (err) {
			if (err.code === 'ECONNREFUSED') {
				console.error('Unable to connect to registry server');
				process.exit(3);
			}
			throw err;
		}

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
