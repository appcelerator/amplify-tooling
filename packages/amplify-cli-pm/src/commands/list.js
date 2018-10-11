export default {
	aliases: [ 'ls' ],
	desc: 'lists all installed packages',
	async action({ argv, console }) {
		const [
			{ default: columnify },
			{ getInstalledPackages }
		] = await Promise.all([
			import('columnify'),
			import('@axway/amplify-registry-sdk')
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

		const columnConfig = {
			columnSplitter: ' | ',
			showHeaders: true,
			config: {
				name: {
					minWidth: 25
				},
				versions: {
					minWidth: 8
				}
			}
		};

		const data = installed.map(d => {
			return {
				name: d.name,
				'installed versions': Object.keys(d.versions),
				'active version': d.version || 'Unknown'
			};
		});
		console.log(columnify(data, columnConfig));

	}
};
