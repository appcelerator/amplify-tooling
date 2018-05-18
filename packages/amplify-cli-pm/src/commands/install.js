import npa from 'npm-package-arg';

import { fetchAndInstall } from '@axway/amplify-registry-sdk';

export default {
	aliases: [ 'i' ],
	desc: 'installs the specified package',
	options: {
		'--auth <account>': {
			desc: 'the authorization account to use'
		},
		'--package-type <type>': {
			desc: 'type of component to search'
		}
	},
	args: [
		{
			name: 'package',
			hint: 'package[@version]',
			desc: 'the package name and version to install',
			required: true
		}
	],
	async action({ argv }) {
		const info = npa(argv.package);
		const { name, fetchSpec } = info;
		const { packageType } = argv;

		try {
			console.log(`Fetching ${name}`);
			const info = await fetchAndInstall({ name, type: packageType, fetchSpec });
			console.log(`Installed ${name}@${info.version}`);
		} catch (e) {
			if (e.code === 'ECONNREFUSED') {
				console.log('Unable to connect to registry server');
				process.exit(3);
			} else if (e.code === 'NO_DATA') {
				console.log('No results found');
				process.exit(1);
			}
			console.log(e);
		}
	}
};
