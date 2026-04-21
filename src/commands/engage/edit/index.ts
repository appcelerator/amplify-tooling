import Command from '../../../lib/command.js';
import { Flags } from '@oclif/core';
import { OutputTypes } from '../../../lib/engage/types.js';
import { commonFlags } from '../../../lib/engage/flags.js';
import { highlight } from '../../../lib/logger.js';

export default class EngageEdit extends Command {
	static override summary = 'Edit and update resources by using the default editor.';

	static override aliases = [ 'central:edit' ];

	static override description = `You must be authenticated to edit one or more resources.
        Run ${highlight('"axway auth login"')} to authenticate.`;

	static override flags = {
		...commonFlags,
		output: Flags.string({
			char: 'o',
			description: `Additional output formats. One of: ${OutputTypes.yaml} | ${OutputTypes.json}`,
		}),
	};

	async run(): Promise<any> {
		return this.help();
	}
}
