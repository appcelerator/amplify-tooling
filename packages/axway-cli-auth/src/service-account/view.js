export default {
	aliases: [ 'v', '!info', '!show' ],
	desc: 'View service account details',
	options: {
		'--account [name]': 'The platform account to use',
		'--client-id <id>': 'The CLI specific client ID',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs service account as JSON'
		}
	},
	async action({ argv, console }) {
		const { createTable, initPlatformAccount } = require('@axway/amplify-cli-utils');
		let { account, sdk } = await initPlatformAccount(argv.account);
		const result = await sdk.serviceAccount.find(account, argv.clientId);

		if (argv.json) {
			console.log(JSON.stringify(result, null, 2));
			return;
		}

		const { default: snooplogg } = require('snooplogg');
		const { highlight, note } = snooplogg.styles;
		const { org, serviceAccount } = result;

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

		console.log('\nTEAMS');
	}
};
