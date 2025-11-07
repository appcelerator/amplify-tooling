import Command from '../../../lib/command.js';

export default class ConfigProfile extends Command {
	static override summary = 'Manage configuration profile options.';

	async run(): Promise<void> {
		await this.config.runCommand('help', [ 'config:profile' ]);
	}
}
