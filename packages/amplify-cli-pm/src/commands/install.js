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
	async action({ argv }) {
		const [
			{ default: npa },
			{ default: ora },
			{ PackageInstaller },
			{ getRegistryParams, handleInstallError }
		] = await Promise.all([
			import('npm-package-arg'),
			import('ora'),
			import('@axway/amplify-registry-sdk'),
			import('../utils')
		]);

		const { name, fetchSpec } = npa(argv.package);
		let spinner;
		try {
			if (!argv.json) {
				spinner = ora(`looking up ${name}`).start();
			}

			const installProcess = new PackageInstaller(Object.assign({
				fetchSpec,
				name
			}, getRegistryParams(argv.env)));

			installProcess
				.on('preActions', () => {
					spinner.text = 'running pre-actions';
				})
				.on('download', () => {
					spinner.text = 'downloading package';
				})
				.on('extract', () => {
					spinner.text = 'extracting package';
				})
				.on('postActions', () => {
					spinner.text = 'running post-actions';
				})
				.on('log', (message) => {
					const currText = spinner.text;
					spinner.info(message);
					spinner = ora(currText).start();
				});

			const info = await installProcess.start();
			if (argv.json) {
				console.log(JSON.stringify({
					success: true,
					name,
					version: info.version
				}, null, '  '));
			} else {
				spinner.succeed(`Installed ${name}@${info.version}`);
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
