import columninfy from 'columnify';
import { Registry } from '@axway/amplify-registry-sdk';

export default {
	aliases: [ 's', 'se' ],
	desc: 'searches registry for packages',
	options: {
		'--auth <account>': {
			desc: 'the authorization account to use'
		},
		'--repositories <repository>': {
			desc: 'comma separated list of repositories to search'
		},
		'--type <type>': {
			desc: 'type of component to search'
		}
	},
	args: [
		{
			name: 'search',
			desc: 'the package name or keywords',
			required: true
		}
	],
	async action({ argv }) {
		try {
			const registry = new Registry();
			const { repositories, search, type } = argv;
			const body = await registry.search({ text: search, repositories, type });
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
				console.log(columninfy(data, columnConfig));
			}
		} catch (e) {
			if (e.code === 'ECONNREFUSED') {
				console.log('Unable to connect to registry server');
				process.exit(3);
			}
			// console.log(e);
		}
	}
};
