import { AxwayCLIState } from '@axway/amplify-cli-utils';

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
	async action({ argv, console }: AxwayCLIState): Promise<void> {
		const { initPlatformAccount, isHeadless } = await import('@axway/amplify-cli-utils');
		const { default: snooplogg } = await import('snooplogg');
		const { highlight } = snooplogg.styles;
		const { org, sdk } = await initPlatformAccount(argv.account as string, argv.org as string, argv.env as string);
		const { default: open } = await import('open');

		if (!org.userRoles?.includes('administrator')) {
			throw new Error('You do not have administrative access to configure this organization\'s identity provider');
		}

		if (!org.entitlements.idp) {
			throw new Error(`The organization "${org.name}" does not have identity provider entitlements`);
		}

		if (isHeadless()) {
			throw new Error('Managing identity provider settings requires a web browser and is unsupported in headless environments');
		}

		const url = `${sdk.platformUrl}#/org/${org.org_id}/settings/idp`;
		console.log(`Opening web browser to ${highlight(url)}`);
		await open(url);
	}
};
