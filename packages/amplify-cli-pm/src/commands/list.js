export default {
	aliases: [ 'ls' ],
	desc: 'lists all installed packages',
	async action({ argv, console }) {
		const [
			{ getInstalledPackages },
			{ default: Table },
			{ snooplogg }
		] = await Promise.all([
			import('@axway/amplify-registry-sdk'),
			import('cli-table3'),
			import('appcd-logger')
		]);

		const installed = getInstalledPackages();

		if (argv.json) {
			console.log(JSON.stringify(installed, null, '  '));
			return;
		}

		if (!installed.length) {
			console.log('No packages installed');
			return;
		}

		const { green } = snooplogg.styles;

		const table = new Table({
			chars: {
				bottom: '', 'bottom-left': '', 'bottom-mid': '', 'bottom-right': '',
				left: '', 'left-mid': '',
				mid: '', 'mid-mid': '', middle: '  ',
				right: '', 'right-mid': '',
				top: '', 'top-left': '', 'top-mid': '', 'top-right': ''
			},
			head: [ 'Name', 'Installed Versions', 'Active Version' ],
			style: {
				head: [ 'bold' ],
				'padding-left': 0,
				'padding-right': 0
			}
		});

		for (const pkg of installed) {
			table.push([
				green(pkg.name),
				Object.keys(pkg.versions).join(', '),
				pkg.version || 'Unknown'
			]);
		}

		console.log(table.toString());
	}
};
