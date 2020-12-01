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
	options: {
		'--json': 'Output installed package as JSON'
	},
	async action({ argv, cli, console, terminal }) {
		const [
			{ PackageInstaller },
			{ default: npa },
			{ default: ora },
			{ default: snooplogg },
			{ getRegistryParams, handleError }
		] = await Promise.all([
			import('@axway/amplify-registry-sdk'),
			import('npm-package-arg'),
			import('ora'),
			import('snooplogg'),
			import('../utils')
		]);

		const { alert, highlight } = snooplogg.styles;
		const { name, fetchSpec } = npa(argv.package);
		const messages = [];
		let spinner;

		try {
			if (!argv.json) {
				spinner = ora({
					text: `Looking up "${name}"`,
					stream: terminal.stderr
				}).start();
			}

			const installProcess = new PackageInstaller({
				fetchSpec,
				name,
				...getRegistryParams(argv.env)
			});

			installProcess
				.on('preActions', () => {
					if (!argv.json) {
						spinner.text = 'Running pre-actions';
					}
				})
				.on('download', () => {
					if (!argv.json) {
						spinner.text = 'Downloading package';
					}
				})
				.on('extract', () => {
					if (!argv.json) {
						spinner.text = 'Extracting package';
					}
				})
				.on('postActions', () => {
					if (!argv.json) {
						spinner.text = 'Running post-actions';
					}
				})
				.on('log', message => {
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
					...info,
					messages: messages.length && messages || undefined
				}, null, 2));
			} else {
				spinner.succeed(`Installed ${highlight(`${name}@${info.version}`)}`);
			}

			// load the extension that was just installed
			if (info.type === 'amplify-cli-plugin') {
				cli.extension(info.path);
			}
			await cli.emitAction('axway:pm:install', info);
		} catch (err) {
			handleError({ console, err, json: argv.json, outputError: e => spinner.fail(alert(e)) });
		}
	}
};
