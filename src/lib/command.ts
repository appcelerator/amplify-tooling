import { Command, Config as OclifConfig, Flags } from '@oclif/core';
import loadConfig, { Config } from './config.js';
import { FlagInput, ParserOutput } from '@oclif/core/lib/interfaces/parser';

export default abstract class AxwayCommand extends Command {
	declare config: OclifConfig & { parsed?: ParserOutput };

	static override baseFlags: FlagInput<{ [flag: string]: any; }> = {
		'no-banner': Flags.boolean({
			description: 'Disable the banner.',
			default: false,
			helpGroup: 'GLOBAL'
		}),
		'no-color': Flags.boolean({
			description: 'Disable color output.',
			default: false,
			helpGroup: 'GLOBAL'
		})
		// TODO:
		// '--profile': Flags.string({
		// 	char: 'p',
		// 	description: 'Specify the configuration profile to use',
		// 	default: 'default'
		// })
	};

	override async parse(ctor: any): Promise<ParserOutput & { config: Config }> {
		const parsed = await super.parse(ctor);
		this.config.parsed = parsed;
		return {
			...parsed,
			config: await loadConfig() // TODO: Support profile from parsed flags
		};
	}
}
