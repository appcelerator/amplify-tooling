export default {
	args: [
		{
			name: 'package',
			desc: 'Name of the package to purge old versions for'
		}
	],
	desc: 'Removes all non-active, managed packages',
	options: {
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the purged packages as JSON'
		},
		'-y, --yes': {
			aliases: [ '--no-prompt' ],
			desc: 'Automatic yes to prompts and run non-interactively'
		}
	},
	skipExtensionUpdateCheck: true,
	async action({ argv, cli, console, terminal }) {
		const { createTable }        = require('@axway/amplify-cli-utils');
		const { default: snooplogg } = require('snooplogg');
		const { listPurgable, uninstallPackage } = require('../pm');
		const { runListr }           = require('../utils');

		const { bold, highlight } = snooplogg.styles;
		const purgeTable = createTable();
		const purgable = await listPurgable(argv.package);
		const removedPackages = {};
		const tasks = [];

		// step 1: determine packages to remove
		for (const [ name, versions ] of Object.entries(purgable)) {
			for (const pkg of versions) {
				tasks.push({
					title: `Purging ${highlight(`${name}@${pkg.version}`)}`,
					task: async (ctx, task) => {
						await uninstallPackage(pkg.path);
						task._task.title = `Purged ${highlight(`${name}@${pkg.version}`)}`;
					}
				});

				purgeTable.push([ `  ${bold(name)}`, pkg.version ]);

				if (!removedPackages[name]) {
					removedPackages[name] = [];
				}
				removedPackages[name].push(pkg);
			}
		}

		if (!purgeTable.length) {
			if (argv.json) {
				console.log(JSON.stringify(removedPackages, null, 2));
			} else {
				console.log('There are no packages to purge.');
			}
			return;
		}

		// step 2: confirm purge
		console.log(`The following packages can be purged:\n\n${purgeTable.toString()}\n`);

		if (terminal.stdout.isTTY && !argv.yes && !argv.json) {
			await new Promise(resolve => {
				terminal.once('keypress', str => {
					terminal.stderr.cursorTo(0);
					terminal.stderr.clearLine();
					if (str === 'y' || str === 'Y') {
						return resolve();
					}
					process.exit(0);
				});
				terminal.stderr.write('Do you want to update? (y/N) ');
			});
		}

		// step 3: run the tasks
		try {
			await runListr({ console, json: argv.json, tasks });
		} catch (err) {
			// errors are stored in the results
		}

		if (argv.json) {
			console.log(JSON.stringify(removedPackages, null, 2));
		}

		await cli.emitAction('axway:pm:purge', removedPackages);
	}
};
