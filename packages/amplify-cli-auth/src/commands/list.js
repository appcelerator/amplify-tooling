export default {
	aliases: [ 'ls' ],
	desc: 'Lists all authenticated accounts',
	options: {
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		const { createTable, initSDK } = require('@axway/amplify-cli-utils');
		const { default: snooplogg } = require('snooplogg');

		const { config, sdk } = initSDK({
			baseUrl:  argv.baseUrl,
			clientId: argv.clientId,
			env:      argv.env,
			realm:    argv.realm
		});

		const accounts = await sdk.auth.list();
		const defaultAccount = config.get('auth.defaultAccount');

		for (const account of accounts) {
			account.default = account.name === defaultAccount;
		}

		if (argv.json) {
			console.log(JSON.stringify(accounts, null, 2));
			return;
		}

		if (!accounts.length) {
			console.log('No authenticated accounts.');
			return;
		}

		const { green } = snooplogg.styles;
		const table = createTable([ 'Account Name', 'Organization', 'Type', 'Expires', 'Environment' ]);
		const now = Date.now();
		const pretty = require('pretty-ms');
		const urlRE = /^.*\/\//;
		const check = process.platform === 'win32' ? '√' : '✔';

		for (const { default: def, auth, isPlatform, name, org } of accounts) {
			table.push([
				def ? green(`${check} ${name}`) : `  ${name}`,
				!org || !org.name ? 'n/a' : org.id ? `${org.name} (${org.id})` : org.name,
				isPlatform ? 'Platform' : 'Service',
				pretty(auth.expires.refresh - now, { secDecimalDigits: 0, msDecimalDigits: 0 }),
				auth.baseUrl.replace(urlRE, '')
			]);
		}

		console.log(table.toString());
	}
};
