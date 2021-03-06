export default {
	aliases: [ 'ls' ],
	desc: 'Lists organizations',
	options: {
		'--account [name]': 'The account to use',
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		const { createTable, initSDK } = require('@axway/amplify-cli-utils');
		const { default: snooplogg } = require('snooplogg');
		const { highlight } = snooplogg.styles;
		const { config, sdk } = initSDK();
		const account = await sdk.auth.find(argv.account || config.get('auth.defaultAccount'));

		if (!account || !account.isPlatform) {
			throw new Error('You must me logged into a platform account\n\nPlease run "axway auth login"');
		}

		const orgs = await sdk.org.list(account, config.get(`auth.defaultOrg.${account.hash}`));

		if (argv.json) {
			console.log(JSON.stringify(orgs, null, 2));
			return;
		}

		console.log(`Account: ${highlight(account.name)}\n`);

		if (!orgs.length) {
			console.log('No organizations found');
			return;
		}

		const { green } = snooplogg.styles;
		const table = createTable([ 'Organization', 'GUID', 'ID' ]);
		const check = process.platform === 'win32' ? '√' : '✔';

		for (const { name, guid, id, active } of orgs) {
			table.push([
				active ? green(`${check} ${name}`) : `  ${name}`,
				guid,
				id
			]);
		}
		console.log(table.toString());
	}
};
