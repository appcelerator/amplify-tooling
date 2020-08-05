export default {
	aliases: [ 'ls' ],
	desc: 'Lists all authenticated accounts',
	options: {
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		const [
			{ createTable, initSDK },
			{ default: snooplogg }
		] = await Promise.all([
			import('@axway/amplify-cli-utils'),
			import('snooplogg')
		]);

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
		const table = createTable([ 'Account Name', 'Organization', 'Expires', 'Environment' ]);
		const now = Date.now();
		const pretty = require('pretty-ms');
		const urlRE = /^.*\/\//;
		const check = process.platform === 'win32' ? '√' : '✔';

		for (const { default: def, auth, name, org } of accounts) {
			table.push([
				def ? green(`${check} ${name}`) : `  ${name}`,
				!org || !org.name ? '' : org.id ? `${org.name} (${org.id})` : org.name,
				pretty(auth.expires.refresh - now, { secDecimalDigits: 0, msDecimalDigits: 0 }),
				auth.baseUrl.replace(urlRE, '')
			]);
		}

		console.log(table.toString());
	}
};
