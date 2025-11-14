import Command from '../../../lib/command.js';

export default class ConfigProfile extends Command {
	static override hidden = true;

	static override summary = 'Manage configuration profile options.';

	static override authenticated = false;
	static override enableProfileFlag = false;

	async run(): Promise<void> {
		return this.help();
	}
}
