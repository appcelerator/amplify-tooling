import { auth } from '@axway/amplify-cli-utils';

export default {
	desc: 'lists all active accounts',
	options: {
		'--json': 'outputs accounts as JSON'
	},
	async action({ argv, console }) {
		try {
			const params = auth.buildParams({
				baseUrl:  argv.baseUrl,
				clientId: argv.clientId,
				env:      argv.env,
				realm:    argv.realm
			});

			const tokens = await auth.list(params);

			if (argv.json) {
				console.log(JSON.stringify(tokens, null, '  '));
				return;
			}

			if (!tokens.length) {
				console.log('No credentials found');
				return;
			}

			const pretty = require('pretty-ms');
			let i = 0;
			for (const token of tokens) {
				i++ && console.log();
				console.log(token.email);
				console.log(`  ${token.baseUrl.replace(/^.*\/\//, '')} (${token.authenticator})`);
				console.log(`  Expires in ${pretty(Date.now() - token.expires.access, { secDecimalDigits: 0, msDecimalDigits: 0 })}`);
			}
		} catch (e) {
			console.error(e.message);
		}
	}
};
