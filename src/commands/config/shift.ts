import Command from '../../lib/command.js';
import { Args } from '@oclif/core';

export default class ConfigShift extends Command {
	static override summary = 'Remove the first value in a list.';

	static override examples = [
		{
			command: '<%= config.bin %> <%= command.id %> <key>',
			description: 'Remove the first value in a list.'
		}
	];

	static override args = {
		key: Args.string({
			description: 'Config key to shift from.',
			required: true
		})
	};

	static override authenticated = false;
	static override enableJsonFlag = true;

	async run(): Promise<{ result: string } | void> {
		const { args, config } = await this.parse(ConfigShift);
		const result = config.shift(args.key);
		config.save();
		if (this.jsonEnabled()) {
			return { result };
		}
		this.log(result);
	}
}
