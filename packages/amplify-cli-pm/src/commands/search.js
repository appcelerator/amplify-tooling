export default {
	aliases: [ 's', 'se' ],
	args: [
		{
			name: 'search',
			desc: 'The package name or keywords',
			required: false
		}
	],
	desc: 'Searches registry for packages',
	options: {
		'--repository [repository]': 'The repository to search',
		'--type [type]': 'Type of package to search'
	},
	async action({ argv, console }) {
		const [
			{ default: Table },
			{ buildUserAgentString, getRegistryParams },
			{ Registry },
			{ snooplogg }
		] = await Promise.all([
			import('cli-table3'),
			import('../utils'),
			import('@axway/amplify-registry-sdk'),
			import('appcd-logger')
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

		const { green } = snooplogg.styles;

		const table = new Table({
			chars: {
				bottom: '', 'bottom-left': '', 'bottom-mid': '', 'bottom-right': '',
				left: '', 'left-mid': '',
				mid: '', 'mid-mid': '', middle: '  ',
				right: '', 'right-mid': '',
				top: '', 'top-left': '', 'top-mid': '', 'top-right': ''
			},
			head: [ 'Name', 'Versions', 'Type', 'Description' ],
			style: {
				head: [ 'bold' ],
				'padding-left': 0,
				'padding-right': 0
			}
		});

		for (const pkg of results) {
			table.push([
				green(pkg.name),
				pkg.version,
				pkg.type,
				pkg.description
			]);
		}

		console.log(table.toString());
	}
};
