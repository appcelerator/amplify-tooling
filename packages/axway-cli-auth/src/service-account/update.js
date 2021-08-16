export default {
	aliases: [ '!up' ],
	desc: 'Updates a service account',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs service account as JSON'
		},
		'--org [name|id|guid]': 'The organization name, id, or guid'
	},
	async action({ argv, cli, console }) {
		const { createTable, initPlatformAccount } = require('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);

		if (!org.userRoles.includes('administrator')) {
			throw new Error(`You do not have administrative access to update a service account in the "${org.name}" organization`);
		}

		const { default: snooplogg } = require('snooplogg');

		console.log('UPDATE SERVICE ACCOUNT');
	}
};
