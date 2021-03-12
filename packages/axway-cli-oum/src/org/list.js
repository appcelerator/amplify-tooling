export default {
	aliases: [ 'ls' ],
	desc: 'Lists organizations',
	options: {
		'--account [name]': 'The account to use',
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		const { initPlatformAccount } = require('../lib/util');
		const { createTable } = require('@axway/amplify-cli-utils');
		const { default: snooplogg } = require('snooplogg');
		const { account, config, sdk } = await initPlatformAccount(argv.account, argv.org);

		const orgs = await sdk.org.list(account, config.get(`auth.defaultOrg.${account.hash}`));

		if (argv.json) {
			console.log(JSON.stringify(orgs, null, 2));
			return;
		}

		const { green, highlight } = snooplogg.styles;
		console.log(`Account: ${highlight(account.name)}\n`);

		if (!orgs.length) {
			console.log('No organizations found');
			return;
		}

		const table = createTable([ 'Organization', 'GUID', 'ID' ]);
		const check = process.platform === 'win32' ? '√' : '✔';

		for (const { default: def, guid, id, name } of orgs) {
			table.push([
				def ? green(`${check} ${name}`) : `  ${name}`,
				guid,
				id
			]);
		}
		console.log(table.toString());
	}
};
