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
			{ getRegistryParams }
		] = await Promise.all([
			import('npm-package-arg'),
			import('@axway/amplify-registry-sdk'),
			import('../utils')
		]);

		const { name, fetchSpec } = npa(argv.package);

		try {
			if (!argv.json) {
				console.log(`Fetching ${name}...`);
			}

			const info = await fetchAndInstall(Object.assign({
				fetchSpec,
				name
			}, getRegistryParams(argv.env)));

			if (argv.json) {
				console.log(JSON.stringify({
					success: true,
					name,
					version: info.version
				}, null, '  '));
			} else {
				console.log(`Installed ${name}@${info.version}`);
			}
		} catch (e) {
			let msg = e;
			let code = 1;

			switch (e.code) {
				case 'ECONNREFUSED':
					msg = 'Unable to connect to registry server';
					code = 3;
					break;
				case 'EINVALIDIR':
					msg = `You are in an invalid directory to install this component type\n${e.message}`;
					break;
				case 'ENONPM':
					msg = e.message;
					break;
				case 'ENPMINSTALLERROR':
					// TODO: Need to break this error down into some sort of actionable items
					msg = `An error occurred when running "npm install"\n${e.stack}`;
					break;
				case 'ENOVERSIONDATA':
					msg = e.message;
					break;
			}

			if (argv.json) {
				console.error(JSON.stringify({ success: false, message: msg }, null, '  '));
			} else {
				console.error(msg);
			}
			process.exit(code);
		}
	}
};
