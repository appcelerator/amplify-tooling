import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';

export default {
	aliases: [ 'v', '!info', '!show' ],
	args: [
		{
			name: 'package',
			hint: 'package[@version]',
			desc: 'The package name and version to view',
			redact: false,
			required: true
		},
		{
			name: 'filter',
			hint: 'field[.subfield]',
			callback({ ctx, value }: AxwayCLIOptionCallbackState) {
				if (value) {
					ctx.banner = false;
				}
			},
			desc: 'Display specific package fields',
			redact: false
		}
	],
	desc: 'Displays info for a specific package',
	options: {
		'--json': {
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => {
				ctx.jsonMode = !!value;
				if (value) {
					ctx.banner = false;
				}
			},
			desc: 'Outputs package info as JSON'
		}
	},
	async action({ argv, cli, console }: AxwayCLIState): Promise<void> {
		const { view } = await import('../pm.js');
		let info: any = await view(argv.package as string);

		if (argv.filter) {
			for (const key of (argv.filter as string).split('.')) {
				if (typeof info !== 'object') {
					break;
				}
				info = Object.prototype.hasOwnProperty.call(info, key) ? info[key] : undefined;
			}
		}

		if (argv.json || argv.filter) {
			cli.banner = false;
			console.log(!info ? null : argv.filter ? info : JSON.stringify(info, null, 2));
			return;
		}

		const { default: snooplogg } = await import('snooplogg');
		const { green, highlight } = snooplogg.styles;

		if (info) {
			console.log(green(`${info.name}@${info.version}`));
			const desc = (info.description || '').trim();
			if (desc) {
				console.log(desc + '\n');
			}

			const { createTable } = await import('@axway/amplify-cli-utils');
			const semver = await import('semver');
			const createVersionTable = (label: string, versions: string[]): string => {
				const majors: { [type: string]: string[] } = {};

				// sort versions into buckets by major version
				for (const ver of versions) {
					const major = semver.major(ver);
					if (!majors[major]) {
						majors[major] = [];
					}
					majors[major].push(ver);
				}

				// build the table of versions
				let i = 0;
				const table = createTable();
				for (const major of Object.keys(majors).sort().reverse()) {
					const versions = majors[major].sort(semver.rcompare);
					if (i++) {
						table.push([ '' ]);
					}
					while (versions.length) {
						const vers = versions.splice(0, 8);
						while (vers.length < 8) {
							vers.push('');
						}
						table.push(vers);
					}
				}

				return label.toUpperCase() + '\n' + highlight(table.toString()) + '\n';
			};

			if (info.versions.length) {
				console.log(createVersionTable('Available versions:', info.versions));
			}

			if (info.installed) {
				console.log(createVersionTable('Installed versions:', Object.keys(info.installed)));
			} else {
				console.log(`To install this package, run:\n\n  ${highlight(`axway pm install ${info.name}`)}`);
			}
		} else {
			console.log(`No result found for ${highlight(`"${argv.package}"`)}`);
		}
	}
};
