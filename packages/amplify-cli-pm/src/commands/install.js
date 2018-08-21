export default {
	aliases: [ 'i' ],
	args: [
		{
			name: 'package',
			hint: 'package[@version]',
			desc: 'the package name and version to install',
			required: true
		}
	],
	desc: 'installs the specified package',
	options: {
		'--auth <account>': 'the authorization account to use'
	},
	async action({ argv, console }) {
		const [
			npa,
			{ fetchAndInstall },
			{ getRegistryURL }
		] = await Promise.all([
			import('npm-package-arg'),
			import('@axway/amplify-registry-sdk'),
			import('../utils')
		]);

		const { name, fetchSpec } = npa(argv.package);
		const url = getRegistryURL();

		try {
			console.log(`Fetching ${name}`);
			const info = await fetchAndInstall({ name, fetchSpec, url });
			console.log(`Installed ${name}@${info.version}`);
		} catch (e) {
			switch (e.code) {
				case 'ECONNREFUSED':
					console.error('Unable to connect to registry server');
					process.exit(3);
				case 'EINVALIDIR':
					console.error('You are in an invalid directory to install this component type');
					console.error(e.message);
					break;
				case 'ENONPM':
					console.error(e.message);
					break;
				case 'ENPMINSTALLERROR':
					// TODO: Need to break this error down into some sort of actionable items
					console.error('An error occurred when running "npm install"');
					console.error(e);
					break;
				case 'NO_DATA':
					console.error('No results found');
					break;
				default:
					console.error(e);
					break;
			}

			process.exit(1);
		}
	}
};
