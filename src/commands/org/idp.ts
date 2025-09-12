import { initPlatformAccount } from '../../lib/utils.js';
import snooplogg from 'snooplogg';

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
		const { highlight } = snooplogg.styles;
		const { org, sdk } = await initPlatformAccount(argv.account, argv.org, argv.env);

		if (!org.userRoles.includes('administrator')) {
			throw new Error('You do not have administrative access to configure this organization\'s identity provider');
		}

		if (!org.entitlements.idp) {
			throw new Error(`The organization "${org.name}" does not have identity provider entitlements`);
		}

		const url = `${sdk.platformUrl}org/${org.id}/settings/idp`;
		console.log(`Open a web browser to the following URL to manage Identity Provider settings: ${highlight(url)}`);
	}
};
