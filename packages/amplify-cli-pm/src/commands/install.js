
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
			{ getRegistryParams, handleInstallError }
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
		} catch (error) {
			const { exitCode, message } = handleInstallError(error);

			if (argv.json) {
				console.error(JSON.stringify({ success: false, message }, null, '  '));
			} else {
				console.error(message);
			}
			process.exitCode = exitCode;
		}
	}
};
