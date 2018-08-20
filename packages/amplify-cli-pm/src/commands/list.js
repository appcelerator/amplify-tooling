export default {
	aliases: [ 'ls' ],
	desc: 'lists all installed packages',
	async action({ argv, console }) {
		const [
			columninfy,
			{ getInstalledPackages }
		] = await Promise.all([
			import('columnify'),
			import('@axway/amplify-registry-sdk')
		]);

		const installed = getInstalledPackages();
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
				'installed versions': d.versions.join(', '),
				'active version': d.activeVersion || 'Unknown'
			};
		});
		console.log(columninfy(data, columnConfig));
	}
};
