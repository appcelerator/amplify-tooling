export default {
	aliases: [ 'ls' ],
	desc: 'List all installed packages',
	options: {
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs packages as JSON'
		}
	},
	async action({ argv, console }) {
		const semver                 = require('semver');
		const { default: snooplogg } = require('snooplogg');
		const { createTable }        = require('@axway/amplify-cli-utils');
		const { list, packagesDir }  = require('../pm');

		const installed = await list();

		if (argv.json) {
			console.log(JSON.stringify(installed, null, 2));
			return;
		}

		const { cyan, gray, green } = snooplogg.styles;
		console.log(`Packages directory: ${cyan(packagesDir)}\n`);

		if (!installed.length) {
			console.log('No packages installed');
			return;
		}

		const table = createTable([ 'Name', 'Versions' ]);
		const unmanaged = {};

		for (const pkg of installed) {
			const { version } = pkg;
			const versions = Object.keys(pkg.versions).sort(semver.rcompare);
			const managed = versions.every(v => pkg.versions[v].managed);

			table.push([
				managed || Object.keys(pkg.versions).some(ver => pkg.versions[ver].managed) ? pkg.name : `${pkg.name} ${gray('(unmanaged)')}`,
				versions.map(v => version && semver.eq(v, version) ? green(v) : v).join(', ')
			]);
			if (!managed) {
				unmanaged[`${pkg.name}${pkg.version}`] = 1;
			}
		}

		console.log(table.toString());

		if (Object.keys(unmanaged).length) {
			console.log('\nNote: Unmanaged packages were not installed by the Axway CLI and cannot be purged or uninstalled.');
		}
	}
};
