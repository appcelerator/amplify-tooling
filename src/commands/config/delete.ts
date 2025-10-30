import Command from '../../lib/command.js';
import { Args } from '@oclif/core';

export default class ConfigDelete extends Command {
	static override aliases = [ 'config:rm', 'config:remove', 'config:unset' ];
	static override summary = 'Remove a config setting.';
	static override examples = [
		{
			command: '<%= config.bin %> <%= command.id %> <key>',
			description: 'Remove a config setting.'
		}
	];
	static override args = {
		key: Args.string({
			description: 'Config key to delete.',
			required: true
		})
	};
	static override enableJsonFlag = true;
	async run(): Promise<{ result: string } | void> {
		const { args, config } = await this.parse(ConfigDelete);
		config.delete(args.key);
		config.save();
		if (this.jsonEnabled()) {
			return { result: 'OK' };
		}
		this.log('OK');
	}
}
