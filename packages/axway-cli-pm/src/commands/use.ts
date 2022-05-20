/**
 * Examples:
 * 	amplify pm use <pkg>
 * 	amplify pm use <pkg>@1.0.1
 * 	amplify pm use <pkg>@latest
 * 	amplify pm use <pkg>@1.x
 */

export default {
	args: [
		{
			name: 'package',
			hint: 'package[@version]',
			desc: 'The package version or latest to activate',
			redact: false,
			required: true
		}
	],
	desc: 'Activates a specific package version',
	options: {
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs activated package as JSON'
		}
	},
	async action({ argv, cli, console }) {
		const { default: npa }       = await import('npm-package-arg');
		const { default: semver }    = await import('semver');
		const { default: snooplogg } = await import('snooplogg');
		const { find }               = await import('../pm');
		const { loadConfig }         = await import('@axway/amplify-cli-utils');

		const { highlight } = snooplogg.styles;
		let { fetchSpec, name, type } = npa(argv.package);
		const installed = await find(name);

		if (!installed) {
			const err = new Error(`Package "${name}" is not installed`);
			err.code = 'ENOTFOUND';
			err.detail = `Please run ${highlight(`"axway pm install ${name}"`)} to install it`;
			throw err;
		}

		if (fetchSpec === 'latest') {
			fetchSpec = '*';
		}

		let version;
		if (fetchSpec === '*' || type === 'range') {
			for (const ver of Object.keys(installed.versions)) {
				if (!version || semver.gt(ver, version)) {
					version = ver;
				}
			}
		} else if (type === 'version') {
			version = fetchSpec;
		}

		if (!version) {
			throw new Error(`No version installed that satisfies ${fetchSpec}`);
		}

		const info = installed.versions[version];

		if (!info) {
			const err = new Error(`Package "${name}@${version}" is not installed`);
			err.code = 'ENOTFOUND';
			err.detail = `Please run ${highlight(`"axway pm install ${name}@${version}"`)} to install it`;
			throw err;
		}

		let msg;
		if (installed.version === version) {
			msg = `${highlight(`${name}@${version}`)} is already the active version`;
		} else {
			msg = `Set ${highlight(`${name}@${version}`)} as action version`;
			installed.version = version;
			(await loadConfig())
				.set(`extensions.${name}`, info.path)
				.save();
		}

		if (argv.json) {
			console.log(JSON.stringify(installed, null, 2));
		} else {
			console.log(msg);
		}

		await cli.emitAction('axway:pm:use', installed);
	}
};
