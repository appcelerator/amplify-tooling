import Command from '../../../lib/command.js';
import { initSDK } from '../../../lib/amplify-sdk/index.js';
import { Args } from '@oclif/core';

export default class ConfigProfileDelete extends Command {
	static override aliases = [
		'config:profile:remove',
		'config:profile:rm'
	];

	static override summary = 'Remove a profile.';

	static override args = {
		profile: Args.string({
			description: 'Profile to remove.',
			required: true
		})
	};

	static override authenticated = false;
	static override enableProfileFlag = false;

	async run(): Promise<void | any> {
		const { args, config } = await this.parse(ConfigProfileDelete);
		const exists = config.has(`profiles.${args.profile}`);
		if (!exists) {
			return this.error(`Profile "${args.profile}" does not exist.`);
		}

		// Set the profile as active in the conf for the SDK
		config.profile = args.profile;
		// Ensure we remove all auth sessions for this profile
		const sdk = await initSDK();
		await sdk.auth.logout({ all: true });

		config.delete(`profiles.${args.profile}`);
		config.save();
		this.log('OK');
	}
}
