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
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Output installed package as JSON'
		}
	},
	async action({ argv, cli, console, terminal }) {
		const [
			{ PackageInstaller },
			{ Extension },
			{ default: npa },
			{ default: ora },
			{ default: snooplogg },
			{ getRegistryParams }
		] = await Promise.all([
			import('@axway/amplify-registry-sdk'),
			import('cli-kit'),
			import('npm-package-arg'),
			import('ora'),
			import('snooplogg'),
			import('../utils')
		]);

		const { highlight } = snooplogg.styles;
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

			if (info.type === 'amplify-cli-plugin') {
				const ext = new Extension(info.path);

				// load the extension that was just installed so that it can receive the `axway:pm:install` action
				cli.extension(ext);

				if (!argv.json) {
					const cmds = Object.keys(ext.exports);
					if (cmds.length) {
						console.log(`\nTo use this new extension, run${cmds.length > 1 ? ' one of the following' : ''}:\n`);
						for (const name of cmds) {
							console.log(highlight(`  axway ${name}`));
						}
					}
				}
			}

			await cli.emitAction('axway:pm:install', info);
		} catch (err) {
			spinner?.stop();
			throw err;
		}
	}
};
