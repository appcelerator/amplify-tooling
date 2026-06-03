import Command from '../../lib/command.js';
import { createKeyList } from '../../lib/formatter.js';

export default class ConfigList extends Command {
	static override aliases = [ 'config:ls' ];

	static override summary = 'Display all config settings.';

	static override examples = [
		{
			command: '<%= config.bin %> <%= command.id %>',
			description: 'List all config settings.'
		},
		{
			command: '<%= config.bin %> <%= command.id %> --json',
			description: 'Return the config as JSON.'
		}
	];

	static override authenticated = false;
	static override enableBanner = false;
	static override enableJsonFlag = true;

	async run() {
		const { config } = await this.parse(ConfigList);
		const configData = await config.data();
		if (this.jsonEnabled()) {
			return configData;
		}
		if (configData && typeof configData === 'object') {
			const keyList = createKeyList(configData);
			if (keyList) {
				this.log(keyList);
			} else {
				this.log('No config settings found');
			}
		} else {
			this.log(configData);
		}
	}
}
