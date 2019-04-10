export default {
	aliases: [ 'ls' ],
	desc: 'lists all authenticated accounts',
	options: {
		'--json': 'outputs accounts as JSON'
	},
	async action({ argv, console }) {
		const { auth, loadConfig } = await import('@axway/amplify-cli-utils');

		const config = loadConfig();

		const params = auth.buildParams({
			baseUrl:  argv.baseUrl,
			clientId: argv.clientId,
			env:      argv.env,
			realm:    argv.realm
		}, config);

		const client = auth.createAuth(params);
		const accounts = await client.list();
		const active = config.get('auth.defaultAccount');

		for (const account of accounts) {
			account.active = account.name === active;
		}

		if (argv.json) {
			console.log(JSON.stringify(accounts, null, '  '));
			return;
		}

		if (!accounts.length) {
			console.log('No authenticated accounts.');
			return;
		}

		console.log('| Active | Account Name | Organization | Expires | Environment |');
		console.log('| ------ | ------------ | ------------ | ------- | ----------- |');

		const now = Date.now();
		const pretty = require('pretty-ms');
		const urlRE = /^.*\/\//;

		for (const account of accounts) {
			const { active, baseUrl, expires, name, org } = account;
			console.log(
				`| ${active ? ':check:' : ' '} `
				+ `| ${name} `
				+ `| ${org && org.name ? `${org.name} (${org.org_id})` : ' '} `
				+ `| ${pretty(expires.refresh - now, { secDecimalDigits: 0, msDecimalDigits: 0 })} `
				+ `| ${baseUrl.replace(urlRE, '')} |`
			);
		}
	}
};
