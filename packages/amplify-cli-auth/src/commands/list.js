export default {
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

		const active = config.get('auth.account');
		const client = new auth.Auth(params);
		const tokens = await client.list();

		for (const token of tokens) {
			token.active = token.email === active;
		}

		if (argv.json) {
			console.log(JSON.stringify(tokens, null, '  '));
			return;
		}

		if (!tokens.length) {
			console.log('No authenticated accounts.');
			return;
		}

		console.log('| Active | Account | Expires | Auth Type | Environment |');
		console.log('| ------ | ------- | ------- | --------- | ----------- |');

		const now = Date.now();
		const pretty = require('pretty-ms');
		const urlRE = /^.*\/\//;

		for (const token of tokens) {
			console.log(`| ${token.active ? ':check:' : ' '} | ${token.email} | ${pretty(token.expires.refresh - now, { secDecimalDigits: 0, msDecimalDigits: 0 })} | ${token.authenticator} | ${token.baseUrl.replace(urlRE, '')} |`);
		}
	}
};
