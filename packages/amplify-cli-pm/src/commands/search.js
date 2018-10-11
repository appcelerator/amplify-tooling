export default {
	aliases: [ 's', 'se' ],
	args: [
		{
			name: 'search',
			desc: 'the package name or keywords',
			required: false
		}
	],
	desc: 'searches registry for packages',
	options: {
		'--auth <account>': 'the authorization account to use',
		'--repository <repository>': 'repository to search',
		'--type <type>': 'type of component to search'
	},
	async action({ argv, console }) {
		const [
			{ default: columnify },
			{ buildUserAgentString, getRegistryParams },
			{ Registry }
		] = await Promise.all([
			import('columnify'),
			import('../utils'),
			import('@axway/amplify-registry-sdk')
		]);

		const registry = new Registry(getRegistryParams(argv.env));
		const { repository, search, type } = argv;
		let results;
		const headers = {
			'User-Agent': buildUserAgentString()
		};
		try {
			results = (await registry.search({ headers, text: search, repository, type })).map(d => {
				return {
					name:        d.name,
					version:     d.version,
					type:        d.type,
					description: d.description
				};
			});
		} catch (e) {
			if (e.code === 'ECONNREFUSED') {
				console.error('Unable to connect to registry server');
				process.exit(3);
			}
			throw e;
		}

		if (argv.json) {
			console.log(JSON.stringify(results, null, '  '));
			return;
		}

		if (!results.length) {
			console.log('No results');
			return;
		}

		const columnConfig = {
			columnSplitter: ' | ',
			showHeaders: true,
			config: {
				name: {
					minWidth: 25
				},
				version: {
					minWidth: 8
				},
				type: {
					minWidth: 8
				},
				description: {
					maxWidth: 80 - (25 + 8)
				}
			}
		};
		console.log(columnify(results, columnConfig));
	}
};
