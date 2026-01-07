import Command from '../../lib/command.js';
import { Args } from '@oclif/core';

export default class ConfigUnshift extends Command {
	static override summary = 'Add a value to the beginning of a list.';

	static override examples = [
		{
			command: '<%= config.bin %> <%= command.id %> <key> <value>',
			description: 'Add a value to the beginning of a list.'
		}
	];

	static override args = {
		key: Args.string({
			description: 'Config key to unshift to.',
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
		const { args, config } = await this.parse(ConfigUnshift);
		let val = args.value;
		try {
			// Try to parse the value as JSON
			val = JSON.parse(val);
		} catch (_err) {
			// If parsing fails, keep the value as a string
		}
		config.unshift(args.key, val);
		config.save();
		if (this.jsonEnabled()) {
			return { result: 'OK' };
		}
		this.log('OK');
	}
}
