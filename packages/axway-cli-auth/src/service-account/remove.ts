export default {
	aliases: [ 'rm' ],
	args: [
		{
			desc: 'The service account client id or name',
			hint: 'client-id/name',
			name: 'client-id',
			required: true
		}
	],
	desc: 'Remove a service account',
	help: {
		header() {
			return `${this.desc}.`;
		}
	},
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the result as JSON'
		},
		'--org [name|id|guid]': 'The organization name, id, or guid'
	},
	async action({ argv, cli, console }) {
		const { initPlatformAccount } = require('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org, argv.env);

		if (!org.userRoles.includes('administrator')) {
			throw new Error(`You do not have administrative access to remove a service account in the "${org.name}" organization`);
		}

		const { client } = await sdk.client.remove(account, org, argv.clientId);
		const results = {
			account: account.name,
			org,
			client
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const { default: snooplogg } = require('snooplogg');
			const { highlight, note } = snooplogg.styles;

			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

			const { client_id, name } = results.client;
			console.log(`Successfully removed service account ${highlight(name)} ${note(`(${client_id})`)}`);
		}

		await cli.emitAction('axway:auth:service-account:remove', results);
	}
};
