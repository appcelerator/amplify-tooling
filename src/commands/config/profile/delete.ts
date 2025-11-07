import Command from '../../../lib/command.js';
import { initSDK } from '../../../lib/utils.js';
import { loadConfig } from '../../../lib/config.js';
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
	async run(): Promise<void | any> {
		const { args } = await this.parse(ConfigProfileDelete);
		const cfg = await loadConfig();
		const exists = cfg.has(`profiles.${args.profile}`);
		if (!exists) {
			return this.error(`Profile "${args.profile}" does not exist.`);
		}

		// Set the profile as active in the conf for the SDK
		cfg.profile = args.profile;
		// Ensure we remove all auth sessions for this profile
		const sdk = await initSDK();
		await sdk.auth.logout({ all: true });

		cfg.delete(`profiles.${args.profile}`);
		cfg.save();
		this.log('OK');
	}
}
