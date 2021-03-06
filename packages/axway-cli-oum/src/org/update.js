export default {
	desc: 'Update organization details',
	options: {
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, cli, console }) {
		const { initSDK } = require('@axway/amplify-cli-utils');
		const { default: snooplogg } = require('snooplogg');
		const { highlight } = snooplogg.styles;
		const { config, sdk } = initSDK();
		const account = await sdk.auth.find(argv.account || config.get('auth.defaultAccount'));

		if (!account || !account.isPlatform) {
			throw new Error('You must me logged into a platform account\n\nPlease run "axway auth login"');
		}

		const org = await sdk.org.get(account, config.get(`auth.defaultOrg.${account.hash}`));

		if (argv.json) {
			// TODO
			return;
		}

		console.log(`Account: ${highlight(account.name)}\n`);

		if (!org) {
			throw new Error();
		}

		await cli.emitAction('axway:oum:org:update', { /* TODO */ });
	}
};
