import Command from '../../lib/command.js';
import { createTable } from '../../lib/formatter.js';
import chalk from 'chalk';
import prettyMilliseconds from 'pretty-ms';
import { initSDK } from '../../lib/amplify-sdk/index.js';

export default class AuthList extends Command {
	static override summary = 'Lists all authenticated accounts.';

	static override description = 'Displays a list of all authenticated accounts, their selected platform organization, and the current team.';

	static override aliases = [ 'auth:ls' ];
	static override authenticated = false;

	static override enableJsonFlag = true;

	async run() {
		const { config } = await this.parse(AuthList);
		const sdk = await initSDK({}, config);

		const accounts = await sdk.auth.list({
			defaultTeams: config.get('auth.defaultTeam'),
			validate: true,
		});
		for (const account of accounts) {
			account.default = account.name === config.get('auth.defaultAccount');
		}

		if (this.jsonEnabled()) {
			return accounts;
		}

		if (!accounts.length) {
			return this.log('No authenticated accounts.');
		}

		const check = process.platform === 'win32' ? '√' : '✔';
		const now = Date.now();
		const table = createTable([ 'Account Name', 'Organization', 'Current Team', 'Region', 'Expires' ]);

		for (const { default: def, auth,  name, org, team } of accounts) {
			const { access, refresh } = auth.expires;
			const expiresMS = (refresh || access) - now;
			table.push([
				`${def ? chalk.green(`${check} ${name}`) : `  ${name}`}`,
				!org || !org.name ? 'n/a' : org.id ? `${org.name} (${org.id})` : org.name,
				team ? `${team.name} (${team.guid})` : 'n/a',
				org?.region || 'US',
				expiresMS > 0
					? prettyMilliseconds(expiresMS, { secondsDecimalDigits: 0, millisecondsDecimalDigits: 0 })
					: 'Expired'
			]);
		}

		this.log(table.toString());
	}
}
