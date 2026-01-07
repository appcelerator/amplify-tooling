import Command from '../../lib/command.js';
import { Args } from '@oclif/core';

export default class ConfigPush extends Command {
	static override summary = 'Add a value to the end of a list.';

	static override examples = [
		{
			command: '<%= config.bin %> <%= command.id %> <key> <value>',
			description: 'Add a value to the end of a list.'
		}
	];

	static override args = {
		key: Args.string({
			description: 'Config key to push to.',
			required: true
		}),
		value: Args.string({
			description: 'Value to add.',
			required: true
		})
	};

	static override authenticated = false;
	static override enableJsonFlag = true;

	async run(): Promise<{ result: string } | void> {
		const { args, config } = await this.parse(ConfigPush);
		let val = args.value;
		try {
			// Try to parse the value as JSON
			val = JSON.parse(val);
		} catch (_err) {
			// If parsing fails, keep the value as a string
		}
		config.push(args.key, val);
		config.save();
		if (this.jsonEnabled()) {
			return { result: 'OK' };
		}
		this.log('OK');
	}
}
