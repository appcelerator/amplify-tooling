export default {
	aliases: [ 'rm' ],
	desc: 'Removes a service account',
	options: {
		'--account [name]': 'The platform account to use',
		'--client-id <id>': 'The service account client ID',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the result as JSON'
		}
	},
	async action({ argv, cli, console }) {
		const { initPlatformAccount } = require('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);

		if (!org.userRoles.includes('administrator')) {
			throw new Error(`You do not have administrative access to remove a service account in the "${org.name}" organization`);
		}

		const serviceAccount = await sdk.serviceAccount.remove(account, argv.clientId);
		const results = {
			account: account.name,
			org,
			serviceAccount
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const { default: snooplogg } = require('snooplogg');
			const { highlight, note } = snooplogg.styles;

			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
			console.log(`Successfully removed service account ${highlight(`"${serviceAccount.name}"`)}`);
		}

		await cli.emitAction('axway:auth:service-account:remove', results);
	}
};
