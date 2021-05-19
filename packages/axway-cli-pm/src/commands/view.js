export default {
	aliases: [ 'v', '!info', '!show' ],
	args: [
		{
			name: 'package',
			hint: 'package[@version]',
			desc: 'The package name and version to view',
			required: true
		},
		{
			name: 'filter',
			hint: 'field[.subfield]',
			desc: 'Display specific package fields'
		}
	],
	desc: 'Displays info for a specific package',
	options: {
		'--json': {
			callback: ({ ctx, value }) => {
				ctx.jsonMode = value;
				if (value) {
					ctx.banner = false;
				}
			},
			desc: 'Outputs package info as JSON'
		}
	},
	async action({ argv, console }) {
		const { view } = require('../pm');
		let info = await view(argv.package);

		if (argv.filter) {
			for (const key of argv.filter.split('.')) {
				if (typeof info !== 'object') {
					break;
				}
				info = Object.prototype.hasOwnProperty.call(info, key) ? info[key] : undefined;
			}
		}

		if (argv.json) {
			console.log(info ? JSON.stringify(info, null, 2) : null);
			return;
		}

		const { default: snooplogg } = require('snooplogg');
		const { highlight } = snooplogg.styles;

		if (info) {
			console.log(highlight(`${info.name}@${info.version}`));
			const desc = (info.description || '').trim();
			if (desc) {
				console.log(desc + '\n');
			}

			if (info.installed) {
				console.log(`Installed versions: ${highlight(Object.keys(info.installed).join(', '))}`);
			} else {
				console.log(`To install this package, run:\n\n  ${highlight(`axway pm install ${info.name}`)}`);
			}
		} else {
			console.log(`No result found for ${highlight(`"${argv.package}"`)}`);
		}
	}
};
