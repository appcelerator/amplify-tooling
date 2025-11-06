import { Command, type Config as OclifConfig, Flags } from '@oclif/core';
import loadConfig, { type Config } from './config.js';

import { type FlagInput, type ParserOutput } from '@oclif/core/interfaces';

export default abstract class AxwayCommand extends Command {
	declare config: OclifConfig & { parsed?: ParserOutput };

	static override baseFlags: FlagInput = {
		'no-banner': Flags.boolean({
			description: 'Disable the banner.',
			default: false,
			helpGroup: 'GLOBAL'
		}),
		'no-color': Flags.boolean({
			description: 'Disable color output.',
			default: false,
			helpGroup: 'GLOBAL'
		}),
		profile: Flags.string({
			description: 'Specify the configuration profile to use.',
			helpGroup: 'GLOBAL'
		})
	};

	override async parse(ctor): Promise<ParserOutput & { config: Config }> {
		const parsed = await super.parse(ctor);
		// Store the parsed result on the config so it can be accessed in the `finally` hooks.
		this.config.parsed = parsed;

		// Load the config, applying the profile if specified.
		const config = await loadConfig();
		config.profile = parsed.flags.profile;

		// Return the parsed result along with the loaded config instance.
		return {
			...parsed,
			config
		};
	}
}
