import { auth, loadConfig } from '@axway/amplify-cli-utils';

export default {
	desc: 'lists all authenticated accounts',
	options: {
		'--json': 'outputs accounts as JSON'
	},
	async action({ argv, console }) {
		const config = loadConfig();

		const params = auth.buildParams({
			baseUrl:  argv.baseUrl,
			clientId: argv.clientId,
			env:      argv.env,
			realm:    argv.realm
		});

		const active = config.get('auth.account');
		const tokens = await auth.list(params);

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
			console.log(`| ${token.active ? ':check:' : ' '} | ${token.email} | ${pretty(token.expires.access - now, { secDecimalDigits: 0, msDecimalDigits: 0 })} | ${token.authenticator} | ${token.baseUrl.replace(urlRE, '')} |`);
		}
	}
};
