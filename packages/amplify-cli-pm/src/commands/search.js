export default {
	aliases: [ 's', 'se' ],
	desc: 'searches registry for packages',
	options: {
		'--auth <account>': {
			desc: 'the authorization account to use'
		},
		'--repository <repository>': {
			desc: 'repository to search'
		},
		'--type <type>': {
			desc: 'type of component to search'
		}
	},
	args: [
		{
			name: 'search',
			desc: 'the package name or keywords',
			required: false
		}
	],
	async action({ argv, console }) {
		const [
			columnify,
			{ getRegistryURL },
			{ Registry }
		] = await Promise.all([
			'columnify',
			'../utils',
			'@axway/amplify-registry-sdk'
		]);

		try {
			const url = getRegistryURL();
			const registry = new Registry({ url });
			const { repository, search, type } = argv;
			const body = await registry.search({ text: search, repository, type });

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
					description: {
						maxWidth: 80 - (25 + 8)
					}
				}
			};
			const data = body.map(d => {
				return {
					name: d.name,
					version: d.latest_version,
					type: d.type,
					description: d.description
				};
			});
			if (!data.length) {
				console.log('No results');
			} else {
				console.log(columnify(data, columnConfig));
			}
		} catch (e) {
			if (e.code === 'ECONNREFUSED') {
				console.log('Unable to connect to registry server');
				process.exit(3);
			}
			console.log(e);
		}
	}
};
