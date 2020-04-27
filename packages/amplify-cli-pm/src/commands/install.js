export default {
	aliases: [ 'i' ],
	args: [
		{
			name: 'package',
			hint: 'package[@version]',
			desc: 'The package name and version to install',
			required: true
		}
	],
	desc: 'Installs the specified package',
	async action({ argv, console, terminal }) {
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
		const messages = [];
		let spinner;

		try {
			if (!argv.json) {
				spinner = ora({
					text: `looking up ${name}`,
					stream: terminal.stderr
				}).start();
			}

			const installProcess = new PackageInstaller(Object.assign({
				fetchSpec,
				name
			}, getRegistryParams(argv.env)));

			installProcess
				.on('preActions', () => {
					if (!argv.json) {
						spinner.text = 'running pre-actions';
					}
				})
				.on('download', () => {
					if (!argv.json) {
						spinner.text = 'downloading package';
					}
				})
				.on('extract', () => {
					if (!argv.json) {
						spinner.text = 'extracting package';
					}
				})
				.on('postActions', () => {
					if (!argv.json) {
						spinner.text = 'running post-actions';
					}
				})
				.on('log', (message) => {
					if (!argv.json) {
						const currText = spinner.text;
						spinner.info(message);
						spinner = ora(currText).start();
					} else {
						messages.push(message);
					}
				});

			const info = await installProcess.start();
			if (argv.json) {
				console.log(JSON.stringify({
					success: true,
					name,
					version: info.version,
					messages
				}, null, '  '));
			} else {
				spinner.succeed(`Installed ${name}@${info.version}`);
			}
		} catch (error) {
			const { exitCode, message } = handleInstallError(error);
			process.exitCode = exitCode;
			if (argv.json) {
				console.error(JSON.stringify({ success: false, message }, null, '  '));
			} else {
				spinner.fail(message);
			}
		}
	}
};
