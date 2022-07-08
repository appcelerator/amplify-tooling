import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';
import { CLICommand } from 'cli-kit';

export default {
	desc: 'View available service account roles',
	help: {
		header(this: CLICommand): string {
			return `${this.desc}.`;
		}
	},
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
			desc: 'Outputs service accounts as JSON'
		},
		'--org [name|id|guid]': 'The organization name, id, or guid; roles vary by org'
	},
	async action({ argv, console }: AxwayCLIState): Promise<void> {
		const { createTable, initPlatformAccount } = await import('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(
			argv.account as string,
			argv.org as string,
			argv.env as string
		);
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

		const { default: snooplogg } = await import('snooplogg');
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
