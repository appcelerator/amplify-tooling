import Command from '../../lib/command.js';
import { Args } from '@oclif/core';

export default class UserCommand extends Command {
	static override deprecationOptions = {
		message: 'The "user" commands are no longer supported as of version 5.0.0. Their references will be removed in a subsequent release.'
	};

	static override summary = 'The "user" commands are no longer supported as of version 5.0.0.';

	static override args = {
		'...': Args.string({
			description: 'User commands are no longer supported.',
			required: false,
			multiple: true,
			hidden: true
		})
	};

	async run() {
		this.error('The "user" commands are no longer supported as of version 5.0.0. Their references will be removed in a subsequent release.');
	}
}
