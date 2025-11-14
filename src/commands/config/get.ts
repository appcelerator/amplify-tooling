import Command from '../../lib/command.js';
import { Args } from '@oclif/core';

export default class ConfigGet extends Command {
	static override summary = 'Display a specific config setting.';

	static override examples = [
		{
			command: '<%= config.bin %> <%= command.id %> get <key>',
			description: 'Get a specific config setting.'
		}
	];

	static override args = {
		key: Args.string({ description: 'Config key to get.' })
	};

    static override authenticated = false;
	static override enableJsonFlag = true;

	async run() {
		const { config, args } = await this.parse(ConfigGet);
		const value = config.get(args.key);
		if (this.jsonEnabled()) {
			return value;
		}
		this.log(value);
	}
}
