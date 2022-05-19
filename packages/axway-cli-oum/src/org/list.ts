export default {
	aliases: [ 'ls' ],
	desc: 'List organizations',
	options: {
		'--account [name]': 'The account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the organizations as JSON'
		}
	},
	async action({ argv, console }) {
		const { createTable, initPlatformAccount } = require('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(argv.account, null, argv.env);
		const orgs = await sdk.org.list(account, org);

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				orgs
			}, null, 2));
			return;
		}

		const { default: snooplogg } = require('snooplogg');
		const { green, highlight } = snooplogg.styles;
		console.log(`Account: ${highlight(account.name)}\n`);

		if (!orgs.length) {
			console.log('No organizations found');
			return;
		}

		const table = createTable([ 'Organization', 'GUID', 'ORG ID' ]);
		const check = process.platform === 'win32' ? '√' : '✔';

		for (const { default: def, guid, id, name } of orgs) {
			table.push([
				def ? green(`${check} ${name}`) : `  ${name}`,
				guid,
				id
			]);
		}
		console.log(table.toString());
	},

	myOtherFunction() {
		console.log('hi from my other function!');
	}
};
