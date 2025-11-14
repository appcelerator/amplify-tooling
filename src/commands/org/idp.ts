import { highlight } from '../../lib/logger.js';
import { Args } from '@oclif/core';
import Command from '../../lib/command.js';

export default class OrgIdp extends Command {
	static override summary = 'Manage organization identity provider settings.';

	static override description = 'The organization must have identity provider entitlements and you must have administrative access.';

	static override args = {
		org: Args.string({
			description: 'The organization name, id, or guid; defaults to the current org.',
			required: false
		})
	};

	async run(): Promise<void | object> {
		const { account, org, sdk } = await this.parse(OrgIdp);

		if (!account.user.roles.includes('administrator')) {
			throw new Error('You do not have administrative access to configure this organization\'s identity provider');
		}

		if (!org.entitlements.idp) {
			throw new Error(`The organization "${org.name}" does not have identity provider entitlements`);
		}

		const url = `${sdk.platformUrl}org/${org.id}/settings/idp`;

		this.log(`Open a web browser to the following URL to manage Identity Provider settings: ${highlight(url)}`);
	}
}
