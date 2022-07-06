import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';

export default {
	aliases: [ 'ls' ],
	desc: 'Lists all authenticated accounts',
	help: `Displays a list of all authenticated accounts, their selected platform
organization, and the current team.`,
	name: 'list',
	options: {
		'--json': {
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
			desc: 'Outputs accounts as JSON'
		}
	},
	async action({ argv, console }: AxwayCLIState): Promise<void> {
		const { createTable, getAuthConfigEnvSpecifier, initSDK } = await import('@axway/amplify-cli-utils');
		const { default: snooplogg } = await import('snooplogg');

		const { config, sdk } = await initSDK({
			baseUrl:  argv.baseUrl as string,
			env:      argv.env as string,
			realm:    argv.realm as string
		});
		const authConfigEnvSpecifier = getAuthConfigEnvSpecifier(sdk.env.name);

		const accounts = await sdk.auth.list({
			defaultTeams: config.get(`${authConfigEnvSpecifier}.defaultTeam`),
			validate: true
		});
		for (const account of accounts) {
			account.default = account.name === config.get(`${authConfigEnvSpecifier}.defaultAccount`);
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
		const check = process.platform === 'win32' ? '√' : '✔';
		const now = Date.now();
		const { default: pretty } = await import('pretty-ms');
		const table = createTable([ 'Account Name', 'Organization', 'Current Team', 'Region', 'Type', 'Expires' ]);

		for (const { default: def, auth, isPlatform, name, org, team } of accounts) {
			const { access, refresh } = auth.expires;
			table.push([
				`${def ? green(`${check} ${name}`) : `  ${name}`}`,
				!org || !org.name ? 'n/a' : org.org_id ? `${org.name} (${org.org_id})` : org.name,
				team ? `${team.name} (${team.guid})` : 'n/a',
				org?.region || 'US',
				isPlatform ? 'Platform' : 'Service',
				pretty((refresh || access) - now, { secondsDecimalDigits: 0, millisecondsDecimalDigits: 0 })
			]);
		}

		console.log(table.toString());
	}
};
