import Command from '../../lib/command.js';
import { Args } from '@oclif/core';

export default class ConfigPop extends Command {
	static override summary = 'Remove the last value in a list.';

	static override examples = [
		{
			command: '<%= config.bin %> <%= command.id %> <key>',
			description: 'Remove the last value in a list.'
		}
	];

	static override args = {
		key: Args.string({
			description: 'Config key to pop from.',
			required: true
		})
	};

	static override authenticated = false;
	static override enableJsonFlag = true;

	async run() {
		const { args, config } = await this.parse(ConfigPop);
		const result = config.pop(args.key);
		config.save();
		if (this.jsonEnabled()) {
			return { result };
		}
		this.log(result);
		return undefined;
	}
}
