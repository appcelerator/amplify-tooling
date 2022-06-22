import {
	AxwayCLIContext,
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';
import { CLICommand } from 'cli-kit';

export default {
	args: [
		{
			desc: 'The service account client id or name',
			hint: 'client-id/name',
			name: 'id',
			required: true
		}
	],
	aliases: [ 'v', '!info', '!show' ],
	desc: 'View service account details',
	help: {
		header(this: CLICommand): string {
			return `${this.desc}.`;
		}
	},
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
			desc: 'Outputs service account as JSON'
		},
		'--org [name|id|guid]': 'The organization name, id, or guid'
	},
	async action({ argv, console }: AxwayCLIState): Promise<void> {
		const { createTable, initPlatformAccount } = await import('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(
			argv.account as string,
			argv.org as string,
			argv.env as string
		);
		const result = await sdk.client.find(account, org, argv.id as string);

		if (argv.json) {
			console.log(JSON.stringify(result, null, 2));
			return;
		}

		const { default: snooplogg } = await import('snooplogg');
		const { highlight, note } = snooplogg.styles;
		const { client } = result;

		console.log(`Account:      ${highlight(account.name)}`);
		console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		if (!client) {
			console.log(`Service account "${argv.clientId}" not found`);
			return;
		}

		console.log('SERVICE ACCOUNT');
		console.log(`  Name:         ${highlight(client.name)}`);
		console.log(`  Client ID:    ${highlight(client.client_id)}`);
		console.log(`  Description:  ${client.description ? highlight(client.description) : note('n/a')}`);
		console.log(`  Date Created: ${client.created ? highlight(new Date(client.created).toLocaleString()) : note('n/a')}`);

		console.log('\nAUTHENTICATION');
		console.log(`  Method:       ${highlight(client.method)}`);

		console.log('\nORG ROLES');
		if (client.roles.length) {
			for (const role of client.roles) {
				console.log(`  ${role}`);
			}
		} else {
			console.log('  No roles found');
		}

		console.log('\nTEAMS');
		if (client.teams.length) {
			const table = createTable([ '  Name', 'Role', 'Description', 'Team GUID' ]);
			for (const { desc, guid, name, roles } of client.teams) {
				table.push([
					`  ${name}`,
					roles.join(', '),
					desc || '',
					guid
				]);
			}
			console.log(table.toString());
		} else {
			console.log('  No teams found');
		}
	}
};
