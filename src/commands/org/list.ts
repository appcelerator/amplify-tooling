import { initPlatformAccount } from '../../lib/utils.js';
import { createTable } from '../../lib/formatter.js';
import { active, highlight } from '../../lib/logger.js';

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
		const { account, org, sdk } = await initPlatformAccount(argv.account, null, argv.env);
		const orgs = await sdk.org.list(account, org);

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				orgs
			}, null, 2));
			return;
		}

		console.log(`Account: ${highlight(account.name)}\n`);

		if (!orgs.length) {
			console.log('No organizations found');
			return;
		}

		const table = createTable([ 'Organization', 'GUID', 'ORG ID' ]);
		const check = process.platform === 'win32' ? '√' : '✔';

		for (const { default: def, guid, id, name } of orgs) {
			table.push([
				def ? active(`${check} ${name}`) : `  ${name}`,
				guid,
				id
			]);
		}
		console.log(table.toString());
	}
};
