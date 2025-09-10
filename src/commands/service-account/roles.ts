import { initPlatformAccount } from '../../lib/utils.js';
import { createTable } from '../../lib/formatter.js';
import snooplogg from 'snooplogg';

export default {
	desc: 'View available service account roles',
	help: {
		header() {
			return `${this.desc}.`;
		}
	},
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs service accounts as JSON'
		},
		'--org [name|id|guid]': 'The organization name, id, or guid; roles vary by org'
	},
	async action({ argv, console }) {
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org, argv.env);
		const orgRoles = await sdk.role.list(account, { client: true, org });
		const teamRoles = await sdk.role.list(account, { team: true, org });

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				org,
				orgRoles,
				teamRoles
			}, null, 2));
			return;
		}

		const { highlight, note } = snooplogg.styles;

		console.log(`Account:      ${highlight(account.name)}`);
		console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		const table = createTable();
		table.push([ { colSpan: 2, content: 'ORGANIZATION ROLES' } ]);
		for (const role of orgRoles) {
			table.push([ `  ${highlight(role.id)}`, role.name ]);
		}
		table.push([ '', '' ]);

		table.push([ { colSpan: 2, content: 'TEAM ROLES' } ]);
		for (const role of teamRoles) {
			table.push([ `  ${highlight(role.id)}`, role.name ]);
		}

		console.log(table.toString());
	}
};
