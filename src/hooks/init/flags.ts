import { type Hook } from '@oclif/core';
import { authenticatedFlags } from '../../lib/command.js';

/**
 * Injects or removes command flags based on command properties.
 * We do this via a hook as oclif does not support dynamic flag definitions
 * on commands.
 */
const hook: Hook.Init = async function (opts) {
	const command = opts.config.commands.find(cmd => cmd.id === opts.id);
	// Add authenticated flags if required
	if (command?.authenticated) {
		Object.assign(command.flags, authenticatedFlags);
	}
	// Remove profile flag if required
	if (command?.enableProfileFlag === false) {
		delete command.flags.profile;
	}
};

export default hook;
