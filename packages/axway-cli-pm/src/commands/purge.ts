import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';
import { PackageData, PurgablePackageMap } from '../types';

export default {
	args: [
		{
			name: 'package',
			desc: 'Name of the package to purge old versions for',
			redact: false
		}
	],
	desc: 'Removes all non-active, managed packages',
	options: {
		'--json': {
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
			desc: 'Outputs the purged packages as JSON'
		},
		'-y, --yes': {
			aliases: [ '--no-prompt' ],
			desc: 'Automatic yes to prompts and run non-interactively'
		}
	},
	skipExtensionUpdateCheck: true,
	async action({ argv, cli, console, terminal }: AxwayCLIState): Promise<void> {
		const { createTable, loadConfig }        = await import('@axway/amplify-cli-utils');
		const { default: snooplogg }             = await import('snooplogg');
		const { listPurgable, uninstallPackage } = await import('../pm.js');
		const { runListr }                       = await import('../utils.js');

		const { bold, highlight } = snooplogg.styles;
		const purgeTable = createTable();
		const purgable: PurgablePackageMap = await listPurgable(argv.package as string);
		const removedPackages: {
			[name: string]: PackageData[]
		} = {};
		const tasks = [];

		// step 1: determine packages to remove
		for (const [ name, versions ] of Object.entries(purgable)) {
			for (const pkg of versions) {
				tasks.push({
					title: `Purging ${highlight(`${name}@${pkg.version}`)}`,
					task: async (ctx: any, task: any) => {
						await uninstallPackage(pkg.path);
						task.title = `Purged ${highlight(`${name}@${pkg.version}`)}`;
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
			await new Promise<void>(resolve => {
				terminal.once('keypress', str => {
					terminal.stderr.cursorTo(0);
					terminal.stderr.clearLine(0);
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
			await runListr({ console, json: !!argv.json, tasks });
		} catch (err: any) {
			// errors are stored in the results
		}

		const cfg = await loadConfig();
		cfg.delete('update.notified');
		await cfg.save();

		if (argv.json) {
			console.log(JSON.stringify(removedPackages, null, 2));
		}

		await cli.emitAction('axway:pm:purge', removedPackages);
	}
};
