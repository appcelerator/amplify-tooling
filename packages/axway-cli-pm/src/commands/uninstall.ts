export default {
	aliases: [ '!un', '!unlink', '!r', 'rm', '!remove' ],
	args: [
		{
			name: 'package',
			hint: 'package[@version]',
			desc: 'The package name and version to uninstall',
			redact: false,
			required: true
		}
	],
	desc: 'Removes the specified package',
	options: {
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs removed packages as JSON'
		}
	},
	skipExtensionUpdateCheck: true,
	async action({ argv, cli, console }) {
		const { default: fs }        = await import('fs-extra');
		const { default: npa }       = await import('npm-package-arg');
		const { default: semver }    = await import('semver');
		const { default: snooplogg } = await import('snooplogg');
		const { dirname }            = await import('path');
		const { runListr }           = await import('../utils');
		const { loadConfig }         = await import('@axway/amplify-cli-utils');
		const {
			find,
			packagesDir,
			uninstallPackage
		}  = await import('../pm');

		const { highlight, note } = snooplogg.styles;
		const { fetchSpec, name, type } = npa(argv.package);
		const installed = await find(name);

		if (!installed) {
			const err = new Error(`Package "${name}" is not installed`);
			err.code = 'ENOTFOUND';
			throw err;
		}

		const installedVersions = Object.keys(installed.versions);
		const replacement = {};
		const versions = [];

		if (type === 'range') {
			for (const ver of installedVersions) {
				if (semver.satisfies(ver, fetchSpec)) {
					versions.push({ version: ver, ...installed.versions[ver] });
					delete installed.versions[ver];
				}
			}
		} else if (type === 'version') {
			const info = installed.versions[fetchSpec];
			if (info) {
				versions.push({ version: fetchSpec, ...info });
				delete installed.versions[fetchSpec];
			}
		} else if (type === 'tag' && fetchSpec === 'latest') {
			let version;
			for (const ver of installedVersions) {
				if (!version || semver.gt(ver, version)) {
					version = ver;
				}
			}
			if (version) {
				versions.push({ version, ...installed.versions[version] });
				delete installed.versions[version];
			}
		}

		if (!versions.length) {
			const err = new Error(`"${name}${fetchSpec === 'latest' ? '' : `@${fetchSpec}`}" is not installed`);
			err.code = 'ENOTFOUND';
			throw err;
		}

		// check if we're NOT uninstalling all versions, and if so, suggest a replacement
		if (installedVersions.length > versions.length) {
			const removed = versions.map(v => v.version);
			const toSelectFrom = installedVersions.filter(v => !removed.includes(v));
			let newVersion;
			for (const ver of toSelectFrom) {
				if (!newVersion || semver.gt(ver, newVersion)) {
					newVersion = ver;
				}
			}
			replacement.path = installed.versions[newVersion].path;
			replacement.version = newVersion;
		}

		// unregister extension
		const tasks = [
			{
				title: `Unregistering ${highlight(name)} extension`,
				task: () => {
					const cfg = await loadConfig();
					if (replacement.path) {
						cfg.set(`extensions.${name}`, replacement.path);
					} else {
						cfg.delete(`extensions.${name}`);
					}
					cfg.save();
				}
			}
		];

		// add uninstall tasks
		for (const { managed, path, version } of versions) {
			if (managed && path.startsWith(packagesDir)) {
				tasks.push({
					title: `Uninstalling ${highlight(`${name}@${version}`)} ${note(`(${path})`)}`,
					task: async () => {
						await uninstallPackage(path);

						const parent = dirname(path);
						if (!fs.readdirSync(parent).filter(file => file !== '.DS_Store').length) {
							await fs.remove(parent);
						}
					}
				});
			}
		}

		// run the tasks
		if (tasks.length) {
			try {
				await runListr({ console, json: argv.json, tasks });

				if (!argv.json && replacement.path) {
					console.log(`\n${highlight(`${name}@${replacement.version}`)} is now the active version`);
				}
			} catch (err) {
				// squelch
			}
		}

		const cfg = await loadConfig();
		cfg.delete('update.notified');
		cfg.save();

		const results = {
			installed,
			replacement,
			uninstalled: versions
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		}

		await cli.emitAction('axway:pm:uninstall', results);
	}
};
