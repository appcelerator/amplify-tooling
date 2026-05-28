import Command from '../../lib/command.js';
import { Args } from '@oclif/core';
import { createKeyList } from '../../lib/formatter.js';

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
	static override enableBanner = false;
	static override enableJsonFlag = true;

	async run() {
		const { config, args } = await this.parse(ConfigGet);
		const value = config.get(args.key);
		if (this.jsonEnabled()) {
			return value;
		}
		// If the value is an array, we want to format it as a list with keys for better readability
		if (Array.isArray(value)) {
			const key = args.key.split('.').pop();
			const keyList = createKeyList({ [key]: value });
			return this.log(keyList || 'undefined');
		}
		const keyList = createKeyList(value);
		this.log(keyList || 'undefined');
	}
}
