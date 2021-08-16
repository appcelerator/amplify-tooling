export default {
	aliases: [ 'v', '!info', '!show' ],
	desc: 'View service account details',
	options: {
		'--account [name]': 'The platform account to use',
		'--client-id [id]': 'The service account client ID',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs service account as JSON'
		},
		'--org [name|id|guid]': 'The organization name, id, or guid'
	},
	async action({ _, argv, console }) {
		const { createTable, initPlatformAccount } = require('@axway/amplify-cli-utils');
		let { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);

		const keyword = argv.clientId || _[0];
		if (!keyword) {
			throw new Error('Missing required --client-id option');
		}
		const result = await sdk.serviceAccount.find(account, org, keyword);

		if (argv.json) {
			console.log(JSON.stringify(result, null, 2));
			return;
		}

		const { default: snooplogg } = require('snooplogg');
		const { highlight, note } = snooplogg.styles;
		const { serviceAccount } = result;

		console.log(`Account:      ${highlight(account.name)}\n`);

		if (!serviceAccount) {
			console.log(`Service account "${argv.clientId}" not found`);
			return;
		}

		console.log('SERVICE ACCOUNT');
		console.log(`  Name:         ${highlight(serviceAccount.name)}`);
		console.log(`  Client ID:    ${highlight(serviceAccount.client_id)}`);
		console.log(`  Description:  ${serviceAccount.description ? highlight(serviceAccount.description) : note('n/a')}`);
		console.log(`  Org Guid:     ${highlight(org.name)} ${note(`(${org.guid})`)}`);
		console.log(`  Date Created: ${highlight(new Date(serviceAccount.created).toLocaleString())}`);

		console.log('\nAUTHENTICATION');
		console.log(`  Method:       ${highlight(serviceAccount.method)}`);

		console.log('\nORG ROLES');
		if (serviceAccount.roles.length) {
			for (const role of serviceAccount.roles) {
				console.log(`  ${role}`);
			}
		} else {
			console.log('  No roles found');
		}

		const table = createTable([ '  Name', 'Role', 'Description', 'GUID', 'User', 'Apps', 'Date Created' ]);
		for (const { apps, created, desc, guid, name, roles, users } of serviceAccount.teams) {
			table.push([
				`  ${name}`,
				roles.join(', '),
				desc || note('n/a'),
				guid,
				users.length,
				apps.length,
				new Date(created).toLocaleDateString()
			]);
		}
		console.log('\nTEAMS');
		if (serviceAccount.teams.length) {
			console.log(table.toString());
		} else {
			console.log('  No teams found');
		}
	}
};
