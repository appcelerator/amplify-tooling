export default {
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid; defaults to the current org'
		}
	],
	desc: 'Manage organization identity provider settings',
	options: {
		'--account [name]': 'The account to use'
	},
	async action({ argv, console }) {
		const { initPlatformAccount, isHeadless } = require('@axway/amplify-cli-utils');
		const { default: snooplogg } = require('snooplogg');
		const { highlight } = snooplogg.styles;
		const { org, sdk } = await initPlatformAccount(argv.account, argv.org);
		const open = require('open');

		if (!org.userRoles.includes('administrator')) {
			throw new Error('You do not have administrative access to configure this organization\'s identity provider');
		}

		if (!org.entitlements.idp) {
			throw new Error(`The organization "${org.name}" does not have identity provider entitlements`);
		}

		if (isHeadless()) {
			throw new Error('Managing identity provider settings requires a web browser and is unsupported in headless environments');
		}

		const url = `${sdk.platformUrl}#/org/${org.id}/settings/idp`;
		console.log(`Opening web browser to ${highlight(url)}`);
		await open(url);
	}
};
