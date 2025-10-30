import Command from '../../lib/command.js';
import { Args } from '@oclif/core';

export default class ConfigSet extends Command {
	static override summary = 'Change a config setting.';
	static override examples = [
		{
			command: '<%= config.bin %> <%= command.id %> <key> <value>',
			description: 'Set a config setting.'
		}
	];
	static override args = {
		key: Args.string({
			description: 'Config key to set.',
			required: true
		}),
		value: Args.string({
			description: 'Value to set.',
			required: true
		})
	};
	static override enableJsonFlag = true;
	async run(): Promise<{ result: string } | void> {
		const { args, config } = await this.parse(ConfigSet);
		let val = args.value;
		try {
			// Try to parse the value as JSON
			val = JSON.parse(val);
		} catch (_err) {
			// If parsing fails, keep the value as a string
		}
		config.set(args.key, val);
		config.save();
		if (this.jsonEnabled()) {
			return { result: 'OK' };
		}
		this.log('OK');
	}
}
