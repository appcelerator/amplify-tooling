export default {
	aliases: [ 'ls' ],
	desc: 'Lists all authenticated accounts',
	name: 'list',
	options: {
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs accounts as JSON'
		}
	},
	async action({ argv, console }) {
		const { createTable, getAuthConfigEnvDefaultSpecifier, initSDK } = require('@axway/amplify-cli-utils');
		const { default: snooplogg } = require('snooplogg');

		const { config, sdk } = initSDK({
			baseUrl:  argv.baseUrl,
			env:      argv.env,
			realm:    argv.realm
		});

		const accounts = await sdk.auth.list();
		const authConfigEnvDefaultSpecifier = getAuthConfigEnvDefaultSpecifier(sdk.env.name);
		const defaultAccount = config.get(`${authConfigEnvDefaultSpecifier}.defaultAccount`);

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
			const { access, refresh } = auth.expires;
			table.push([
				def ? green(`${check} ${name}`) : `  ${name}`,
				!org || !org.name ? 'n/a' : org.id ? `${org.name} (${org.id})` : org.name,
				isPlatform ? 'Platform' : 'Service',
				pretty((refresh || access) - now, { secDecimalDigits: 0, msDecimalDigits: 0 }),
				`${auth.env} (${auth.baseUrl.replace(urlRE, '')})`
			]);
		}

		console.log(table.toString());
	}
};
