import { createTable, initPlatformAccount } from '@axway/amplify-cli-utils';
import snooplogg from 'snooplogg';

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
		header() {
			return `${this.desc}.`;
		}
	},
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs service account as JSON'
		},
		'--org [name|id|guid]': 'The organization name, id, or guid'
	},
	async action({ argv, console }) {
		let { account, org, sdk } = await initPlatformAccount(argv.account, argv.org, argv.env);
		const result = await sdk.client.find(account, org, argv.id);

		if (argv.json) {
			console.log(JSON.stringify(result, null, 2));
			return;
		}

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
			const table = createTable([ '  Name', 'Role', 'Description', 'Team GUID', 'User', 'Apps', 'Date Created' ]);
			for (const { apps, created, desc, guid, name, roles, users } of client.teams) {
				table.push([
					`  ${name}`,
					roles.join(', '),
					desc || '',
					guid,
					users?.length || 0,
					apps?.length || 0,
					new Date(created).toLocaleDateString()
				]);
			}
			console.log(table.toString());
		} else {
			console.log('  No teams found');
		}
	}
};
