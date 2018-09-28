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
			{ getRegistryParams },
			{ Registry }
		] = await Promise.all([
			import('../utils'),
			import('@axway/amplify-registry-sdk')
		]);

		const registry = new Registry(getRegistryParams(argv.env));
		const { repository, search, type } = argv;
		let results;
		const headers = {
			'User-Agent': `AMPLIFY CLI/v${process.env.AMPLIFY_CLI}`
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

		console.log('| Name | Version | Type | Description |');
		console.log('| ---- | ------- | ---- | ----------- |');
		for (const result of results) {
			console.log(`| ${result.name} | ${result.version} | ${result.type} | ${result.description} |`);
		}
	}
};
